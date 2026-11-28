
import math

import httpx

from fastapi import APIRouter, Depends, HTTPException

from auth import get_current_user
from database import service_supabase


router = APIRouter(
    prefix="/barcode",
    tags=["Barcode"],
)


OPEN_FOOD_FACTS_URL = "https://world.openfoodfacts.org/api/v2/product"

# Open Food Facts field -> your database nutrient code
NUTRIENT_FIELDS = {
    "energy-kcal_100g": "energy_kcal",
    "proteins_100g": "protein",
    "carbohydrates_100g": "carbohydrate",
    "fat_100g": "fat",
}


def numeric_value(value):
    """Return a valid non-negative number, or None."""
    try:
        result = float(value)
        if math.isfinite(result) and result >= 0:
            return result
    except (TypeError, ValueError):
        pass

    return None


def get_cached_food(barcode):
    response = (
        service_supabase.table("foods")
        .select("*")
        .eq("barcode", barcode)
        .limit(1)
        .execute()
    )

    if not response.data:
        return None

    return response.data[0]


def get_food_macros(food_id):
    response = (
        service_supabase.table("food_macros")
        .select("*")
        .eq("food_id", food_id)
        .limit(1)
        .execute()
    )

    if response.data:
        return response.data[0]

    return None


def build_food_response(food, cached):
    return {
        "food": food,
        "macros": get_food_macros(food["id"]),
        "cached": cached,
    }


@router.get("/{barcode}")
async def lookup_barcode(
    barcode: str,
    auth=Depends(get_current_user),
):
    barcode = barcode.strip()
    if len(barcode) == 12 and barcode.isdigit():
         barcode = "0" + barcode

    """
    Look up a barcode in Supabase first.
    If it is not cached, retrieve it from Open Food Facts
    and save the product and available core nutrients.
    """

    # Validate barcode
    if not barcode.isdigit() or not 8 <= len(barcode) <= 14:
        raise HTTPException(
            status_code=400,
            detail="Barcode must contain 8 to 14 digits.",
        )

    # 1. Check Supabase cache
    try:
        existing_food = get_cached_food(barcode)
    except Exception:
        raise HTTPException(
            status_code=500,
            detail="Could not check the food database.",
        )

    if existing_food:
        return build_food_response(existing_food, cached=True)

    # 2. Request product from Open Food Facts
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                f"{OPEN_FOOD_FACTS_URL}/{barcode}.json",
                headers={
                    "User-Agent": "FORM-App/1.0 (food barcode lookup)"
                },
            )
            response.raise_for_status()
            result = response.json()

    except (httpx.HTTPError, ValueError):
        raise HTTPException(
            status_code=502,
            detail="Could not retrieve product information.",
        )

    if result.get("status") != 1 or not result.get("product"):
        raise HTTPException(
            status_code=404,
            detail="Product not found.",
        )

    product = result["product"]

    # 3. Extract product information
    name = product.get("product_name")

    if not name:
        raise HTTPException(
            status_code=404,
            detail="Product does not have a usable name.",
        )

    brands = product.get("brands")
    brand = brands.split(",")[0].strip() if brands else None

    serving_g = numeric_value(product.get("serving_quantity"))
    serving_label = product.get("serving_size")

    source_id = product.get("code") or barcode
    nutriments = product.get("nutriments") or {}

    # 4. Insert product into foods
    food_data = {
        "name": name,
        "brand": brand,
        "source": "open_food_facts",
        "source_id": source_id,
        "barcode": barcode,
        "serving_g": serving_g,
        "serving_label": serving_label,
        "data_tier": "community",
    }

    try:
        insert_response = (
            service_supabase.table("foods")
            .insert(food_data)
            .execute()
        )

        if not insert_response.data:
            raise HTTPException(
                status_code=500,
                detail="Could not save the product.",
            )

        food = insert_response.data[0]

    except HTTPException:
        raise

    except Exception:
        # Another request may have cached this barcode at the same time.
        try:
            existing_food = get_cached_food(barcode)
        except Exception:
            existing_food = None

        if existing_food:
            return build_food_response(existing_food, cached=True)

        raise HTTPException(
            status_code=500,
            detail="Could not save the product to the database.",
        )

    # 5. Find matching nutrient IDs
    nutrient_values = {}

    for off_field, nutrient_code in NUTRIENT_FIELDS.items():
        amount = numeric_value(nutriments.get(off_field))

        if amount is not None:
            nutrient_values[nutrient_code] = amount

    if nutrient_values:
        try:
            nutrient_response = (
                service_supabase.table("nutrients")
                .select("id, code")
                .in_("code", list(nutrient_values.keys()))
                .execute()
            )

            nutrient_ids = {
                item["code"]: item["id"]
                for item in nutrient_response.data
            }

            # 6. Save available nutrient values
            nutrient_rows = []

            for code, amount in nutrient_values.items():
                nutrient_id = nutrient_ids.get(code)

                if nutrient_id:
                    nutrient_rows.append({
                        "food_id": food["id"],
                        "nutrient_id": nutrient_id,
                        "amount_per_100g": amount,
                        "is_known": True,
                    })

            if nutrient_rows:
                service_supabase.table("food_nutrients").upsert(
                    nutrient_rows,
                    on_conflict="food_id,nutrient_id",
                ).execute()

        except Exception:
            raise HTTPException(
                status_code=500,
                detail="Product was saved, but its nutrition data could not be saved.",
            )

    # 7. Return product and calculated macros
    return build_food_response(food, cached=False)
