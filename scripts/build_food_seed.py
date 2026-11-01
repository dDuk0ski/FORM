"""Build supabase/seed.sql from the USDA SR Legacy CSV download.

Usage:
    python scripts/build_food_seed.py <path to FoodData_Central_sr_legacy_food_csv_2018-04>

Download: https://fdc.nal.usda.gov/download-datasets (SR Legacy, CSV).
Ids are uuid5 of the USDA ids, so rebuilding the seed keeps the same rows.
"""

import csv
import sys
import uuid
from pathlib import Path

NAMESPACE = uuid.UUID("6f1c2a52-6f0e-4d0a-9a51-3b0f6a0e5f10")

# code, USDA nutrient id, display name, unit
NUTRIENTS = [
    ("energy_kcal", 1008, "Energy", "kcal"),
    ("protein", 1003, "Protein", "g"),
    ("carbohydrate", 1005, "Carbohydrate", "g"),
    ("fat", 1004, "Fat", "g"),
    ("saturated_fat", 1258, "Saturated fat", "g"),
    ("fiber", 1079, "Fiber", "g"),
    ("sugars", 2000, "Sugars", "g"),
    ("cholesterol", 1253, "Cholesterol", "mg"),
    ("sodium", 1093, "Sodium", "mg"),
    ("potassium", 1092, "Potassium", "mg"),
    ("calcium", 1087, "Calcium", "mg"),
    ("iron", 1089, "Iron", "mg"),
    ("magnesium", 1090, "Magnesium", "mg"),
    ("zinc", 1095, "Zinc", "mg"),
    ("vitamin_a", 1106, "Vitamin A", "µg"),
    ("vitamin_c", 1162, "Vitamin C", "mg"),
    ("vitamin_d", 1114, "Vitamin D", "µg"),
    ("vitamin_e", 1109, "Vitamin E", "mg"),
    ("vitamin_k", 1185, "Vitamin K", "µg"),
    ("vitamin_b6", 1175, "Vitamin B6", "mg"),
    ("vitamin_b12", 1178, "Vitamin B12", "µg"),
    ("folate", 1190, "Folate", "µg"),
]

# USDA food id, name shown in the app
FOODS = [
    (171287, "Egg, whole, raw"),
    (173424, "Egg, hard-boiled"),
    (172183, "Egg white, raw"),
    (173904, "Oats, rolled, dry"),
    (168878, "White rice, cooked"),
    (169704, "Brown rice, cooked"),
    (168917, "Quinoa, cooked"),
    (169737, "Pasta, cooked"),
    (172688, "Whole-wheat bread"),
    (174924, "White bread"),
    (175049, "Bagel, plain"),
    (175037, "Flour tortilla"),
    (170093, "Potato, baked, with skin"),
    (168483, "Sweet potato, baked"),
    (168399, "Sweet corn, cooked"),
    (173944, "Banana"),
    (171688, "Apple, with skin"),
    (167762, "Strawberries"),
    (171711, "Blueberries"),
    (169097, "Orange"),
    (171705, "Avocado"),
    (170379, "Broccoli, raw"),
    (169967, "Broccoli, boiled"),
    (168462, "Spinach, raw"),
    (170393, "Carrots, raw"),
    (170457, "Tomato, raw"),
    (170000, "Onion, raw"),
    (169247, "Romaine lettuce"),
    (171267, "Milk, 2%"),
    (171265, "Milk, whole"),
    (170894, "Greek yogurt, nonfat, plain"),
    (171304, "Greek yogurt, whole milk, plain"),
    (173414, "Cheddar cheese"),
    (170847, "Mozzarella, part skim"),
    (172182, "Cottage cheese, 2%"),
    (173418, "Cream cheese"),
    (173410, "Butter, salted"),
    (171413, "Olive oil"),
    (172470, "Peanut butter, smooth"),
    (170567, "Almonds"),
    (170187, "Walnuts"),
    (173735, "Black beans, cooked"),
    (173757, "Chickpeas, cooked"),
    (172421, "Lentils, cooked"),
    (172475, "Tofu, firm"),
    (174289, "Hummus"),
    (171477, "Chicken breast, roasted"),
    (172388, "Chicken thigh, roasted"),
    (175168, "Salmon, Atlantic, cooked"),
    (173709, "Tuna, canned in water"),
    (175180, "Shrimp, cooked"),
    (174031, "Ground beef 90/10, cooked"),
    (168250, "Pork tenderloin, roasted"),
    (171506, "Ground turkey, cooked"),
    (173180, "Whey protein powder"),
    (169640, "Honey"),
    (169655, "Sugar, granulated"),
]


def sql(value):
    if value is None:
        return "NULL"
    if isinstance(value, bool):
        return "TRUE" if value else "FALSE"
    if isinstance(value, (int, float)):
        return repr(value)
    return "'" + str(value).replace("'", "''") + "'"


# Preferred default serving, in order. A whole item beats a cup when USDA has both.
SERVING_WORDS = ["medium", "large", "slice", "tortilla", "container", "scoop", "oz", "tbsp", "tablespoon", "cup"]


# Where the word ranking picks a poor default, the USDA portion to use instead (its modifier text).
SERVING_OVERRIDES = {
    167762: "cup, halves",
    168399: "cup",
    168462: "cup",
    169640: "tbsp",
    169655: "tsp",
    169967: "cup, chopped",
    170567: "oz (23 whole kernels)",
    171265: "cup",
    171267: "cup",
    171477: "breast, bone and skin removed",
    171705: "avocado, NS as to Florida or California",
    172421: "cup",
    173709: "can",
    174924: "slice",
}


def default_portion(rows, units, override=None):
    """The household measure to show by default, as (grams, label)."""
    if not rows:
        return None, None

    def rank(r):
        text = " ".join([units.get(r["measure_unit_id"], ""), r["portion_description"], r["modifier"]]).lower()
        hits = [i for i, w in enumerate(SERVING_WORDS) if w in text]
        return (hits[0] if hits else len(SERVING_WORDS), int(r["seq_num"] or 0))

    matches = [r for r in rows if override and r["modifier"] == override]
    p = min(matches or rows, key=lambda r: int(r["seq_num"] or 0)) if matches else min(rows, key=rank)
    amount = float(p["amount"] or 1)
    unit = units.get(p["measure_unit_id"], "")
    words = p["portion_description"] or p["modifier"]
    if unit == "undetermined":
        unit = ""
    label = " ".join(x for x in (f"{amount:g}", unit, words) if x).replace(", NS as to Florida or California", "")
    return float(p["gram_weight"]), label


def main(src: Path) -> str:
    wanted = {fdc for fdc, _ in FOODS}
    by_nutrient = {nid: code for code, nid, _, _ in NUTRIENTS}
    units = {r["id"]: r["name"] for r in csv.DictReader(open(src / "measure_unit.csv"))}

    amounts: dict[int, dict[str, float]] = {fdc: {} for fdc in wanted}
    for r in csv.DictReader(open(src / "food_nutrient.csv")):
        fdc, nid = int(r["fdc_id"]), int(r["nutrient_id"])
        if fdc in wanted and nid in by_nutrient:
            amounts[fdc][by_nutrient[nid]] = float(r["amount"])

    portions: dict[int, list] = {fdc: [] for fdc in wanted}
    for r in csv.DictReader(open(src / "food_portion.csv")):
        if int(r["fdc_id"]) in wanted:
            portions[int(r["fdc_id"])].append(r)

    out = [
        "-- Generated by scripts/build_food_seed.py from USDA FoodData Central SR Legacy (2018-04).",
        "-- Values are per 100 g. A nutrient USDA does not report is null with is_known = false.",
        "-- Safe to run more than once: existing rows are left alone.",
        "",
    ]
    for code, nid, name, unit in NUTRIENTS:
        nut_id = uuid.uuid5(NAMESPACE, f"nutrient:{nid}")
        out.append(
            "INSERT INTO public.nutrients (id, code, name, unit) VALUES "
            f"({sql(str(nut_id))}, {sql(code)}, {sql(name)}, {sql(unit)}) ON CONFLICT DO NOTHING;"
        )
    out.append("")
    for fdc, name in FOODS:
        food_id = uuid.uuid5(NAMESPACE, f"usda:{fdc}")
        grams, label = default_portion(portions[fdc], units, SERVING_OVERRIDES.get(fdc))
        out.append(
            "INSERT INTO public.foods (id, name, source, source_id, serving_g, serving_label, data_tier) VALUES "
            f"({sql(str(food_id))}, {sql(name)}, 'usda', {sql(str(fdc))}, {sql(grams)}, {sql(label)}, 'reference') ON CONFLICT DO NOTHING;"
        )
        values = []
        for code, nid, _, _ in NUTRIENTS:
            amount = amounts[fdc].get(code)
            nut_id = uuid.uuid5(NAMESPACE, f"nutrient:{nid}")
            values.append(f"({sql(str(food_id))}, {sql(str(nut_id))}, {sql(amount)}, {sql(amount is not None)})")
        out.append(
            "INSERT INTO public.food_nutrients (food_id, nutrient_id, amount_per_100g, is_known) VALUES\n    "
            + ",\n    ".join(values)
            + "\nON CONFLICT DO NOTHING;"
        )
    return "\n".join(out) + "\n"


if __name__ == "__main__":
    seed = main(Path(sys.argv[1]))
    target = Path(__file__).resolve().parent.parent / "supabase" / "seed.sql"
    target.write_text(seed)
    print(f"wrote {target} ({len(FOODS)} foods, {len(NUTRIENTS)} nutrients)")
