
from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from supabase import create_client

from auth import get_current_user
from database import url, key

router = APIRouter()


@router.get("/today")
def get_today(auth=Depends(get_current_user)):
    user = auth["user"]
    token = auth["token"]

    user_id = str(user.id)
    today = date.today().isoformat()

    # Create a Supabase client using the logged-in user's token.
    user_supabase = create_client(url, key)
    user_supabase.postgrest.auth(token)

    try:
        target_result = (
            user_supabase.table("targets")
            .select("*")
            .eq("user_id", user_id)
            .lte("effective_date", today)
            .order("effective_date", desc=True)
            .limit(1)
            .execute()
        )

        record_result = (
            user_supabase.table("daily_records")
            .select("*")
            .eq("user_id", user_id)
            .eq("date", today)
            .limit(1)
            .execute()
        )

    except Exception as e:
        print(
            f"GET /today database error: {type(e).__name__}: {e}",
            flush=True,
        )
        raise HTTPException(
            status_code=502,
            detail="Unable to retrieve today's data",
        )

    target = target_result.data[0] if target_result.data else None
    record = record_result.data[0] if record_result.data else None

    def number(value):
        return float(value) if value is not None else None

    consumed = {
        "kcal": number(record.get("kcal_in")) if record else 0,
        "protein_g": number(record.get("protein")) if record else 0,
        "carb_g": number(record.get("carb")) if record else 0,
        "fat_g": number(record.get("fat")) if record else 0,
    }

    targets = {
        "kcal": number(target.get("kcal")) if target else None,
        "protein_g": number(target.get("protein_g")) if target else None,
        "carb_g": number(target.get("carb_g")) if target else None,
        "fat_g": number(target.get("fat_g")) if target else None,
    }

    remaining = {
        name: (
            targets[name] - consumed[name]
            if targets[name] is not None
            else None
        )
        for name in targets
    }

    return {
        "date": today,
        "targets": targets,
        "consumed": consumed,
        "remaining": remaining,
        "readiness": number(record.get("readiness")) if record else None,
    }
