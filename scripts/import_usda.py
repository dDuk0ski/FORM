import argparse
import csv
import os
from decimal import Decimal
from pathlib import Path

import psycopg

LOCAL_DATABASE_URL = "postgresql://postgres:postgres@127.0.0.1:54322/postgres"

USDA_DIR = None

def parse_args():
    parser = argparse.ArgumentParser(
        description="Import USDA SR Legacy food data into FORM."
    )

    parser.add_argument(
        "usda_dir",
        type=Path,
        help="Path to the unzipped USDA SR Legacy CSV folder.",
    )

    args = parser.parse_args()

    if not args.usda_dir.is_dir():
        parser.error(f"Directory does not exist: {args.usda_dir}")

    required_files = [
        "food.csv",
        "food_nutrient.csv",
        "nutrient.csv",
        "food_portion.csv",
        "measure_unit.csv",
    ]

    missing_files = [
        filename
        for filename in required_files
        if not (args.usda_dir / filename).is_file()
    ]

    if missing_files:
        parser.error(
            f"Missing required CSV files: {', '.join(missing_files)}"
        )

    return args

# Existing FORM nutrients: USDA ID -> FORM code.
CORE_NUTRIENTS = {
    1008: "energy_kcal",
    1003: "protein",
    1005: "carbohydrate",
    1004: "fat",
    1258: "saturated_fat",
    1079: "fiber",
    2000: "sugars",
    1253: "cholesterol",
    1093: "sodium",
    1092: "potassium",
    1087: "calcium",
    1089: "iron",
    1090: "magnesium",
    1095: "zinc",
    1106: "vitamin_a",
    1162: "vitamin_c",
    1114: "vitamin_d",
    1109: "vitamin_e",
    1185: "vitamin_k",
    1175: "vitamin_b6",
    1178: "vitamin_b12",
    1190: "folate",
}

# Additional nutrients: USDA ID, FORM code, name, unit.
ADDITIONAL_NUTRIENTS = [
    (1051, "water", "Water", "g"),
    (1057, "caffeine", "Caffeine", "mg"),
    (1091, "phosphorus", "Phosphorus", "mg"),
    (1098, "copper", "Copper", "mg"),
    (1101, "manganese", "Manganese", "mg"),
    (1103, "selenium", "Selenium", "µg"),
    (1165, "thiamin", "Thiamin (B1)", "mg"),
    (1166, "riboflavin", "Riboflavin (B2)", "mg"),
    (1167, "niacin", "Niacin (B3)", "mg"),
    (1170, "pantothenic_acid", "Pantothenic acid (B5)", "mg"),
    (1177, "folate_total", "Folate, total", "µg"),
    (1180, "choline", "Choline", "mg"),
    (1272, "dha", "DHA", "g"),
    (1278, "epa", "EPA", "g"),
    (1280, "dpa", "DPA", "g"),
    (1292, "monounsaturated_fat", "Monounsaturated fat", "g"),
    (1293, "polyunsaturated_fat", "Polyunsaturated fat", "g"),
    (1404, "omega_3_ala", "Omega-3 ALA", "g"),
]

# Combine existing and additional nutrient mappings.
USDA_NUTRIENT_CODES = {
    **CORE_NUTRIENTS,
    **{
        usda_id: code
        for usda_id, code, _, _ in ADDITIONAL_NUTRIENTS
    },
}


def import_measure_units(conn):
    csv_path = USDA_DIR / "measure_unit.csv"

    with csv_path.open("r", encoding="utf-8-sig", newline="") as file:
        reader = csv.DictReader(file)
        rows = [
            (int(row["id"]), row["name"].strip())
            for row in reader
        ]

    with conn.cursor() as cur:
        cur.executemany(
            """
            INSERT INTO public.measure_units (id, name)
            VALUES (%s, %s)
            ON CONFLICT (id)
            DO UPDATE SET name = EXCLUDED.name;
            """,
            rows,
        )

    print(f"Imported {len(rows)} measurement units.")


def import_foods(conn):
    csv_path = USDA_DIR / "food.csv"

    with csv_path.open("r", encoding="utf-8-sig", newline="") as file:
        reader = csv.DictReader(file)
        rows = [
            (
                row["description"].strip(),
                "usda",
                row["fdc_id"],
                "reference",
            )
            for row in reader
        ]

    with conn.cursor() as cur:
        cur.executemany(
            """
            INSERT INTO public.foods (
                name,
                source,
                source_id,
                data_tier
            )
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (source, source_id)
            WHERE source_id IS NOT NULL
            DO NOTHING;
            """,
            rows,
        )

    print(f"Processed {len(rows)} USDA food records.")


def import_nutrients(conn):
    rows = [
        (name, unit, code)
        for _, code, name, unit in ADDITIONAL_NUTRIENTS
    ]

    with conn.cursor() as cur:
        cur.executemany(
            """
            INSERT INTO public.nutrients (name, unit, code)
            VALUES (%s, %s, %s)
            ON CONFLICT (code)
            DO NOTHING;
            """,
            rows,
        )

    print(f"Processed {len(rows)} additional nutrient definitions.")


def get_food_map(conn):
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT source_id, id
            FROM public.foods
            WHERE source = 'usda'
              AND source_id IS NOT NULL;
            """
        )

        return {
            source_id: food_id
            for source_id, food_id in cur.fetchall()
        }


def get_nutrient_map(conn):
    codes = list(USDA_NUTRIENT_CODES.values())

    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT code, id
            FROM public.nutrients
            WHERE code = ANY(%s);
            """,
            (codes,),
        )

        nutrient_ids = {
            code: nutrient_id
            for code, nutrient_id in cur.fetchall()
        }

    missing = set(codes) - set(nutrient_ids)

    if missing:
        raise RuntimeError(
            f"Missing nutrient definitions: {sorted(missing)}"
        )

    return {
        usda_id: nutrient_ids[code]
        for usda_id, code in USDA_NUTRIENT_CODES.items()
    }


def import_food_nutrients(conn):
    food_map = get_food_map(conn)
    nutrient_map = get_nutrient_map(conn)

    csv_path = USDA_DIR / "food_nutrient.csv"

    batch = []
    batch_size = 10000
    processed = 0
    skipped = 0

    with csv_path.open("r", encoding="utf-8-sig", newline="") as file:
        reader = csv.DictReader(file)

        with conn.cursor() as cur:
            for row in reader:
                usda_nutrient_id = int(row["nutrient_id"])

                if usda_nutrient_id not in nutrient_map:
                    continue

                food_id = food_map.get(row["fdc_id"])

                if food_id is None:
                    skipped += 1
                    continue

                amount_text = row["amount"].strip()
                amount = Decimal(amount_text) if amount_text else None

                nutrient_id = nutrient_map[usda_nutrient_id]

                batch.append(
                    (
                        food_id,
                        nutrient_id,
                        amount,
                        amount is not None,
                    )
                )

                if len(batch) >= batch_size:
                    cur.executemany(
                        """
                        INSERT INTO public.food_nutrients (
                            food_id,
                            nutrient_id,
                            amount_per_100g,
                            is_known
                        )
                        VALUES (%s, %s, %s, %s)
                        ON CONFLICT (food_id, nutrient_id)
                        DO NOTHING;
                        """,
                        batch,
                    )

                    processed += len(batch)
                    batch.clear()

            if batch:
                cur.executemany(
                    """
                    INSERT INTO public.food_nutrients (
                        food_id,
                        nutrient_id,
                        amount_per_100g,
                        is_known
                    )
                    VALUES (%s, %s, %s, %s)
                    ON CONFLICT (food_id, nutrient_id)
                    DO NOTHING;
                    """,
                    batch,
                )

                processed += len(batch)

    print(f"Processed {processed} USDA nutrient measurements.")
    print(f"Skipped {skipped} measurements without a matching food.")


def import_food_portions(conn):
    food_map = get_food_map(conn)

    csv_path = USDA_DIR / "food_portion.csv"

    batch = []
    batch_size = 5000
    processed = 0
    skipped = 0

    with csv_path.open("r", encoding="utf-8-sig", newline="") as file:
        reader = csv.DictReader(file)

        with conn.cursor() as cur:
            for row in reader:
                food_id = food_map.get(row["fdc_id"])

                if food_id is None:
                    skipped += 1
                    continue

                amount_text = row["amount"].strip()
                gram_weight_text = row["gram_weight"].strip()

                if not amount_text or not gram_weight_text:
                    raise ValueError(
                        f"Missing amount or gram weight "
                        f"for USDA portion {row['id']}"
                    )

                amount = Decimal(amount_text)
                gram_weight = Decimal(gram_weight_text)

                if amount < 0 or gram_weight <= 0:
                    raise ValueError(
                        f"Invalid portion measurements "
                        f"for USDA portion {row['id']}"
                    )

                modifier = row["modifier"].strip()
                portion_description = row["portion_description"].strip()

                if portion_description and portion_description != modifier:
                    modifier = f"{modifier} ({portion_description})"

                batch.append(
                    (
                        food_id,
                        int(row["id"]),
                        int(row["seq_num"]),
                        amount,
                        int(row["measure_unit_id"]),
                        modifier,
                        gram_weight,
                    )
                )

                if len(batch) >= batch_size:
                    cur.executemany(
                        """
                        INSERT INTO public.food_portions (
                            food_id,
                            usda_portion_id,
                            seq_num,
                            amount,
                            measure_unit_id,
                            modifier,
                            gram_weight
                        )
                        VALUES (%s, %s, %s, %s, %s, %s, %s)
                        ON CONFLICT (usda_portion_id)
                        DO NOTHING;
                        """,
                        batch,
                    )

                    processed += len(batch)
                    batch.clear()

            if batch:
                cur.executemany(
                    """
                    INSERT INTO public.food_portions (
                        food_id,
                        usda_portion_id,
                        seq_num,
                        amount,
                        measure_unit_id,
                        modifier,
                        gram_weight
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (usda_portion_id)
                    DO NOTHING;
                    """,
                    batch,
                )

                processed += len(batch)

    print(f"Processed {processed} USDA food portions.")
    print(f"Skipped {skipped} portions without a matching food.")


def verify_import(conn):
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT COUNT(*)
            FROM public.foods
            WHERE source = 'usda';
            """
        )
        print("\nTotal USDA foods:", cur.fetchone()[0])

        cur.execute(
            """
            SELECT COUNT(*)
            FROM public.measure_units;
            """
        )
        print("Total measurement units:", cur.fetchone()[0])

        cur.execute(
            """
            SELECT COUNT(*)
            FROM public.nutrients;
            """
        )
        print("Total nutrient definitions:", cur.fetchone()[0])

        cur.execute(
            """
            SELECT COUNT(*)
            FROM public.food_nutrients;
            """
        )
        print("Total food nutrient records:", cur.fetchone()[0])

        cur.execute(
            """
            SELECT COUNT(*)
            FROM public.food_portions;
            """
        )
        print("Total food portions:", cur.fetchone()[0])

        cur.execute(
            """
            SELECT COUNT(DISTINCT food_id)
            FROM public.food_portions;
            """
        )
        print("Foods with portions:", cur.fetchone()[0])

        cur.execute(
            """
            SELECT
                n.name,
                COUNT(*) AS food_count
            FROM public.food_nutrients fn
            JOIN public.nutrients n ON n.id = fn.nutrient_id
            JOIN public.foods f ON f.id = fn.food_id
            WHERE f.source = 'usda'
            GROUP BY n.name
            ORDER BY n.name;
            """
        )

        print("\nUSDA nutrient coverage:")
        for name, count in cur.fetchall():
            print(f"{name}: {count}")


def main():
    global USDA_DIR

    args = parse_args()
    USDA_DIR = args.usda_dir

    database_url = os.environ.get(
        "DATABASE_URL",
        LOCAL_DATABASE_URL,
    )

    print(f"USDA directory: {USDA_DIR}")
    print("Connecting to database...")

    with psycopg.connect(database_url) as conn:
        import_measure_units(conn)
        import_foods(conn)
        import_nutrients(conn)
        import_food_nutrients(conn)
        import_food_portions(conn)
        verify_import(conn)


if __name__ == "__main__":
    main()