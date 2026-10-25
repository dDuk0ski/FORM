import json
import re
from collections import Counter
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parent

INPUT_FILE = BASE_DIR / "exercises.json"
OUTPUT_FILE = BASE_DIR / "normalized_exercises.json"
REPORT_FILE = BASE_DIR / "exercise_normalization_report.json"
NORMALIZATION_VERSION = "1.0"

EQUIPMENT_MAP = {
    "body weight": "body_weight",
    "bodyweight": "body_weight",
    "dumbbell": "dumbbell",
    "cable": "cable",
    "barbell": "barbell",
    "leverage machine": "leverage_machine",
    "band": "resistance_band",
    "resistance band": "resistance_band",
    "smith machine": "smith_machine",
    "kettlebell": "kettlebell",
    "weighted": "weighted",
    "stability ball": "stability_ball",
    "ez barbell": "ez_barbell",
    "assisted": "assisted",
    "sled machine": "sled_machine",
    "medicine ball": "medicine_ball",
    "rope": "rope",
    "roller": "roller",
    "bosu ball": "bosu_ball",
    "olympic barbell": "olympic_barbell",
    "wheel roller": "wheel_roller",
    "upper body ergometer": "upper_body_ergometer",
    "skierg machine": "skierg_machine",
    "hammer": "hammer",
    "stationary bike": "stationary_bike",
    "tire": "tire",
    "trap bar": "trap_bar",
    "elliptical machine": "elliptical_machine",
    "stepmill machine": "stepmill_machine",
}

CATEGORY_MAP = {
    "strength": "strength",
    "stretch": "stretching",
    "cardio": "cardio",
    "olympic": "olympic_weightlifting",
}

BODY_REGION_MAP = {
    "upper body": "upper_body",
    "lower body": "lower_body",
    "full body": "full_body",
}

MUSCLE_MAP = {
    "abs": "abs",
    "obliques": "obliques",
    "serratus": "serratus",
    "chest": "chest",
    "lats": "lats",
    "upper back": "upper_back",
    "lower back": "lower_back",
    "front delts": "front_delts",
    "side delts": "side_delts",
    "rear delts": "rear_delts",
    "upper traps": "upper_traps",
    "biceps": "biceps",
    "triceps": "triceps",
    "forearms": "forearms",
    "glutes": "glutes",
    "quads": "quadriceps",
    "hamstrings": "hamstrings",
    "calves": "calves",
    "adductors": "adductors",
    "abductors": "abductors",
    "neck": "neck",
}

MUSCLE_GROUP_MAP = {
    "abs": "core",
    "obliques": "core",
    "serratus": "core",
    "chest": "chest",
    "lats": "back",
    "upper_back": "back",
    "lower_back": "back",
    "front_delts": "shoulders",
    "side_delts": "shoulders",
    "rear_delts": "shoulders",
    "upper_traps": "back",
    "biceps": "biceps",
    "triceps": "triceps",
    "forearms": "forearms",
    "glutes": "glutes",
    "quadriceps": "quadriceps",
    "hamstrings": "hamstrings",
    "calves": "calves",
    "adductors": "adductors",
    "abductors": "abductors",
    "neck": "neck",
}

MOVEMENT_GROUP_MAP = {
    "core": "core",
    "biceps curls": "elbow_flexion",
    "triceps extensions": "elbow_extension",
    "chest": "horizontal_push",
    "pulls": "pull",
    "squat movements": "knee_dominant",
    "overhead presses": "vertical_push",
    "calf raises/jumps": "calf",
    "hip hinges": "hip_dominant",
    "rear delt flys": "horizontal_pull",
    "forearm exercises": "forearm",
    "lateral raises": "shoulder_abduction",
    "pull-overs": "pullover",
    "shrugs": "scapular_elevation",
    "leg curls": "knee_flexion",
    "front raises": "shoulder_flexion",
    "hip thrusts & kickbacks": "hip_extension",
    "hip adduction & abduction": "hip_abduction_adduction",
    "leg extensions": "knee_extension",
    "scapular work": "scapular",
}

VOLUME_PROFILE_MAP = {
    "biceps curls": "elbow_flexion",
    "triceps extensions": "elbow_extension",
    "ab crunches": "ab_crunch",
    "dumbbell bench press": "horizontal_press",
    "cable rows": "horizontal_pull",
    "barbell squats": "squat",
    "oblique twists & side bends": "oblique",
    "dumbbell overhead press": "vertical_press",
    "standing calf raises": "calf_raise",
    "chin-ups & pulldowns": "vertical_pull",
    "rear delt flys": "rear_delt",
    "lunges & step-ups": "unilateral_knee_dominant",
    "chest flys": "chest_fly",
    "pull-ups & wide pulldowns": "vertical_pull",
    "lateral raises": "lateral_raise",
    "pull-overs": "pullover",
    "wrist curls": "wrist_flexion",
    "back extensions": "back_extension",
    "shrugs": "shrug",
    "leg curls": "knee_flexion",
    "wrist extensions": "wrist_extension",
    "deadlifts": "deadlift",
    "leg presses, hack & belt squats": "knee_dominant_press",
    "seated calf raises": "calf_raise",
    "barbell bench press": "horizontal_press",
    "hip thrusts & glute kickbacks": "hip_extension",
    "hip extensions & pull-throughs": "hip_extension",
    "romanian deadlifts": "hip_hinge",
    "barbell overhead press": "vertical_press",
    "good mornings": "hip_hinge",
    "grip work": "grip",
    "hip abduction": "hip_abduction",
    "hip adduction": "hip_adduction",
    "scapular protraction": "scapular_protraction",
    "leg extensions": "knee_extension",
    "scapular depression": "scapular_depression",
}

ISOLATION_PATTERNS = (
    "curl",
    "extension",
    "fly",
    "flys",
    "raise",
    "kickback",
    "calf raise",
    "shrug",
    "wrist curl",
    "wrist extension",
    "abduction",
    "adduction",
)

COMPOUND_PATTERNS = (
    "bench press",
    "chest press",
    "incline press",
    "decline press",
    "overhead press",
    "shoulder press",
    "military press",
    "push up",
    "push-up",
    "dip",
    "row",
    "pull up",
    "pull-up",
    "pulldown",
    "chin up",
    "chin-up",
    "squat",
    "lunge",
    "step up",
    "step-up",
    "deadlift",
    "romanian deadlift",
    "good morning",
    "clean",
    "snatch",
    "thruster",
    "hip thrust",
    "leg press",
    "hack squat",
)

UNILATERAL_PATTERNS = (
    "single arm",
    "single-arm",
    "single leg",
    "single-leg",
    "one arm",
    "one-arm",
    "one leg",
    "one-leg",
    "unilateral",
    "alternating",
    "split squat",
    "bulgarian",
    "pistol squat",
    "step up",
    "step-up",
    "lunge",
)

CORE_TERMS = {"abs", "obliques", "serratus"}
UPPER_BODY_GROUPS = {"chest", "back", "shoulders", "biceps", "triceps", "forearms", "neck"}
LOWER_BODY_GROUPS = {"glutes", "quadriceps", "hamstrings", "calves", "adductors", "abductors"}


def normalize_string(value):
    if value is None:
        return None
    if not isinstance(value, str):
        value = str(value)
    value = re.sub(r"\s+", " ", value.strip())
    return value if value else None


def slugify(value):
    value = normalize_string(value)
    if not value:
        return None
    value = value.lower()
    value = value.replace("&", " and ")
    value = re.sub(r"[/]+", " ", value)
    value = re.sub(r"[^a-z0-9]+", "_", value)
    value = re.sub(r"_+", "_", value).strip("_")
    return value or None


def normalize_equipment(value):
    if value is None:
        return []
    values = value if isinstance(value, list) else [value]
    result = []
    for item in values:
        normalized = normalize_string(item)
        if not normalized:
            continue
        key = normalized.lower()
        result.append(EQUIPMENT_MAP.get(key, slugify(normalized)))
    return list(dict.fromkeys(result))


def normalize_category(value):
    normalized = normalize_string(value)
    if not normalized:
        return None
    key = normalized.lower()
    return CATEGORY_MAP.get(key, slugify(normalized))


def normalize_body_region(value):
    normalized = normalize_string(value)
    if not normalized:
        return None
    key = normalized.lower()
    return BODY_REGION_MAP.get(key, slugify(normalized))


def normalize_muscle(value):
    normalized = normalize_string(value)
    if not normalized:
        return None
    key = normalized.lower()
    if key == "none":
        return None
    return MUSCLE_MAP.get(key, slugify(normalized))


def normalize_muscles(value):
    if value is None:
        return []
    values = value if isinstance(value, list) else [value]
    result = []
    for item in values:
        normalized = normalize_muscle(item)
        if normalized:
            result.append(normalized)
    return list(dict.fromkeys(result))


def normalize_movement_group(value):
    normalized = normalize_string(value)
    if not normalized:
        return None
    key = normalized.lower()
    if key == "none":
        return None
    return MOVEMENT_GROUP_MAP.get(key, slugify(normalized))


def normalize_volume_profile(value):
    normalized = normalize_string(value)
    if not normalized:
        return None
    key = normalized.lower()
    if key == "none":
        return None
    return VOLUME_PROFILE_MAP.get(key, slugify(normalized))


def normalize_volume(value):
    if not isinstance(value, dict):
        return {}
    result = {}
    for muscle, amount in value.items():
        normalized_muscle = normalize_muscle(muscle)
        if normalized_muscle is None:
            continue
        try:
            result[normalized_muscle] = float(amount)
        except (TypeError, ValueError):
            result[normalized_muscle] = amount
    return result


def normalize_language_data(value):
    if not isinstance(value, dict):
        return {}
    result = {}
    for language, content in value.items():
        language_key = normalize_string(language)
        if not language_key:
            continue
        if isinstance(content, list):
            result[language_key] = [str(item) for item in content if item is not None]
        elif content is not None:
            result[language_key] = str(content)
    return result


def infer_muscle_groups(primary, secondary):
    groups = []
    for muscle in list(primary) + list(secondary):
        group = MUSCLE_GROUP_MAP.get(muscle)
        if group and group not in groups:
            groups.append(group)
    return groups


def infer_body_region(source_region, muscle_groups):
    normalized_source = normalize_body_region(source_region)
    if normalized_source:
        return normalized_source

    groups = set(muscle_groups)
    if groups and groups.issubset(CORE_TERMS):
        return "core"
    if groups & UPPER_BODY_GROUPS and groups & LOWER_BODY_GROUPS:
        return "full_body"
    if groups & UPPER_BODY_GROUPS:
        return "upper_body"
    if groups & LOWER_BODY_GROUPS:
        return "lower_body"
    return None


def infer_movement_pattern(name, movement_group, volume_profile):
    text = " ".join(
        part for part in [normalize_string(name), movement_group, volume_profile] if part
    ).lower()

    if any(term in text for term in ("squat", "lunge", "step-up", "step up", "leg press", "leg extension")):
        if "leg extension" in text:
            return "knee_extension"
        return "knee_dominant"

    if any(term in text for term in ("deadlift", "romanian", "good morning", "hip hinge", "back extension", "pull-through")):
        return "hip_dominant"

    if any(term in text for term in ("bench press", "chest press", "push-up", "push up", "chest fly")):
        return "horizontal_push"

    if any(term in text for term in ("row", "rear delt fly", "rear delt")):
        return "horizontal_pull"

    if any(term in text for term in ("pull-up", "pull up", "pulldown", "chin-up", "chin up")):
        return "vertical_pull"

    if any(term in text for term in ("overhead press", "shoulder press", "military press")):
        return "vertical_push"

    if any(term in text for term in ("curl", "elbow flexion")):
        return "elbow_flexion"

    if any(term in text for term in ("triceps extension", "elbow extension")):
        return "elbow_extension"

    if any(term in text for term in ("lateral raise", "front raise", "rear delt fly", "shoulder abduction")):
        return "shoulder_isolation"

    if any(term in text for term in ("calf raise", "calf jump", "plantar")):
        return "plantar_flexion"

    if "hip abduction" in text or "abductor" in text:
        return "hip_abduction"

    if "hip adduction" in text or "adductor" in text:
        return "hip_adduction"

    if any(term in text for term in ("crunch", "oblique", "ab exercise", "core")):
        return "core"

    if movement_group:
        return movement_group
    return None


def infer_unilateral(name):
    text = normalize_string(name)
    if not text:
        return False
    text = text.lower()
    return any(pattern in text for pattern in UNILATERAL_PATTERNS)


def infer_compound(exercise):
    category = normalize_category(exercise.get("category"))
    if category in {"cardio", "stretching"}:
        return False
    if category == "olympic_weightlifting":
        return True

    name = normalize_string(exercise.get("name"))
    movement_group = normalize_movement_group(exercise.get("movement_group"))
    if not name:
        return False

    text = f"{name} {movement_group or ''}".lower()

    if any(pattern in text for pattern in COMPOUND_PATTERNS):
        return True
    if any(pattern in text for pattern in ISOLATION_PATTERNS):
        return False

    return movement_group in {
        "horizontal_push",
        "pull",
        "knee_dominant",
        "vertical_push",
        "hip_dominant",
        "horizontal_pull",
        "hip_extension",
    }


def infer_exercise_type(category, compound):
    if category == "cardio":
        return "cardio"
    if category == "stretching":
        return "stretch"
    if category == "olympic_weightlifting":
        return "compound"
    return "compound" if compound else "isolation"


def normalize_exercise(exercise):
    exercise_id = normalize_string(exercise.get("id"))
    name = normalize_string(exercise.get("name"))

    category = normalize_category(exercise.get("category"))
    primary = normalize_muscles(exercise.get("primary_muscle"))
    secondary = normalize_muscles(exercise.get("secondary_muscle"))
    muscle_groups = infer_muscle_groups(primary, secondary)
    body_region = infer_body_region(exercise.get("body_region"), muscle_groups)
    movement_group = normalize_movement_group(exercise.get("movement_group"))
    volume_profile = normalize_volume_profile(exercise.get("volume_profile"))
    compound = infer_compound(exercise)

    return {
        "id": exercise_id,
        "name": name,
        "classification": {
            "category": category,
            "body_region": body_region,
            "movement_group": movement_group,
            "volume_profile": volume_profile,
            "exercise_type": infer_exercise_type(category, compound),
        },
        "equipment": normalize_equipment(exercise.get("equipment")),
        "muscles": {
            "primary": primary,
            "secondary": secondary,
            "groups": muscle_groups,
            "volume": normalize_volume(exercise.get("volume")),
        },
        "movement": {
            "pattern": infer_movement_pattern(name, movement_group, volume_profile),
            "unilateral": infer_unilateral(name),
            "compound": compound,
        },
        "instructions": normalize_language_data(exercise.get("instructions")),
        "instruction_steps": normalize_language_data(exercise.get("instruction_steps")),
        "metadata": {
            "source_id": exercise_id,
            "created_at": exercise.get("created_at"),
            "normalization_version": NORMALIZATION_VERSION,
        },
    }


def load_exercises(path):
    with open(path, "r", encoding="utf-8") as file:
        data = json.load(file)

    if isinstance(data, list):
        return data
    if isinstance(data, dict):
        for key in ("exercises", "data", "items"):
            if isinstance(data.get(key), list):
                return data[key]

    raise ValueError("Expected the input JSON to contain a list of exercises.")


def count_values(exercises, field):
    counts = Counter()
    for exercise in exercises:
        value = exercise.get(field)
        if isinstance(value, list):
            values = value
        else:
            values = [value]
        for item in values:
            normalized = normalize_string(item)
            if normalized and normalized.lower() != "none":
                counts[normalized] += 1
            else:
                counts["None"] += 1
    return dict(counts.most_common())


def normalized_distribution(exercises, getter):
    counts = Counter()
    for exercise in exercises:
        value = getter(exercise)
        if isinstance(value, list):
            for item in value:
                if item:
                    counts[item] += 1
        elif value:
            counts[value] += 1
    return dict(counts.most_common())


def create_report(raw, normalized, failures):
    ids = [exercise.get("id") for exercise in raw if exercise.get("id") is not None]
    id_counts = Counter(ids)
    duplicate_ids = {key: count for key, count in id_counts.items() if count > 1}

    required_fields = [
        "id",
        "name",
        "equipment",
        "category",
        "primary_muscle",
        "secondary_muscle",
        "body_region",
        "movement_group",
        "volume_profile",
        "volume",
        "instructions",
        "instruction_steps",
        "created_at",
    ]

    missing_fields = {}
    for field in required_fields:
        missing_fields[field] = sum(
            1 for exercise in raw
            if field not in exercise or exercise.get(field) in (None, "", [], {})
        )

    report = {
        "normalization_version": NORMALIZATION_VERSION,
        "dataset": {
            "raw_exercises": len(raw),
            "normalized_exercises": len(normalized),
            "failed_exercises": len(failures),
            "duplicate_ids": duplicate_ids,
        },
        "missing_raw_fields": missing_fields,
        "raw_distributions": {
            "equipment": count_values(raw, "equipment"),
            "category": count_values(raw, "category"),
            "primary_muscle": count_values(raw, "primary_muscle"),
            "secondary_muscle": count_values(raw, "secondary_muscle"),
            "body_region": count_values(raw, "body_region"),
            "movement_group": count_values(raw, "movement_group"),
            "volume_profile": count_values(raw, "volume_profile"),
        },
        "normalized_distributions": {
            "category": normalized_distribution(
                normalized,
                lambda x: x["classification"]["category"],
            ),
            "body_region": normalized_distribution(
                normalized,
                lambda x: x["classification"]["body_region"],
            ),
            "movement_group": normalized_distribution(
                normalized,
                lambda x: x["classification"]["movement_group"],
            ),
            "volume_profile": normalized_distribution(
                normalized,
                lambda x: x["classification"]["volume_profile"],
            ),
            "exercise_type": normalized_distribution(
                normalized,
                lambda x: x["classification"]["exercise_type"],
            ),
            "movement_pattern": normalized_distribution(
                normalized,
                lambda x: x["movement"]["pattern"],
            ),
            "equipment": normalized_distribution(
                normalized,
                lambda x: x["equipment"],
            ),
            "primary_muscle": normalized_distribution(
                normalized,
                lambda x: x["muscles"]["primary"],
            ),
            "muscle_groups": normalized_distribution(
                normalized,
                lambda x: x["muscles"]["groups"],
            ),
        },
        "inferred_fields": {
            "body_region_missing_after_normalization": sum(
                1 for exercise in normalized
                if exercise["classification"]["body_region"] is None
            ),
            "movement_pattern_missing": sum(
                1 for exercise in normalized
                if exercise["movement"]["pattern"] is None
            ),
            "primary_muscle_missing": sum(
                1 for exercise in normalized
                if not exercise["muscles"]["primary"]
            ),
            "unilateral": sum(
                1 for exercise in normalized
                if exercise["movement"]["unilateral"]
            ),
            "compound": sum(
                1 for exercise in normalized
                if exercise["movement"]["compound"]
            ),
        },
        "failures": failures,
    }

    return report


def normalize_dataset(input_file, output_file, report_file):
    raw = load_exercises(input_file)
    normalized = []
    failures = []

    for index, exercise in enumerate(raw):
        try:
            if not isinstance(exercise, dict):
                raise ValueError("Exercise record is not an object")
            normalized.append(normalize_exercise(exercise))
        except Exception as exc:
            failures.append({
                "index": index,
                "source_id": exercise.get("id") if isinstance(exercise, dict) else None,
                "error": str(exc),
            })

    output_file = Path(output_file)
    report_file = Path(report_file)
    output_file.parent.mkdir(parents=True, exist_ok=True)
    report_file.parent.mkdir(parents=True, exist_ok=True)

    with open(output_file, "w", encoding="utf-8") as file:
        json.dump(normalized, file, indent=2, ensure_ascii=False)

    report = create_report(raw, normalized, failures)
    with open(report_file, "w", encoding="utf-8") as file:
        json.dump(report, file, indent=2, ensure_ascii=False)

    print(f"Raw exercises: {len(raw)}")
    print(f"Normalized exercises: {len(normalized)}")
    print(f"Failed exercises: {len(failures)}")
    print(f"Output: {output_file}")
    print(f"Report: {report_file}")


if __name__ == "__main__":
    normalize_dataset(INPUT_FILE, OUTPUT_FILE, REPORT_FILE)
