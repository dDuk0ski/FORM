from datetime import date, timedelta

from conftest import USER_A, USER_B, complete_profile


def log(user_id, local_date, kcal, protein_g=None, carb_g=None, fat_g=None, logged_at=None):
    return {
        "user_id": user_id, "local_date": local_date, "logged_at": logged_at or f"{local_date}T12:00:00Z",
        "kcal": kcal, "protein_g": protein_g, "carb_g": carb_g, "fat_g": fat_g,
    }


def seed_user(db, today, **profile):
    db.tables["profiles"] = [complete_profile(**profile)]
    db.tables["body_metrics"] = [{"user_id": USER_A, "date": (today - timedelta(days=1)).isoformat(), "weight_kg": 82.0}]


def test_new_user_gets_formula_targets_and_they_are_saved(client, db, fixed_today):
    seed_user(db, fixed_today)

    body = client.get("/today").json()

    assert body["date"] == "2026-11-19"
    assert body["target_source"] == "formula"
    assert body["targets"]["kcal"] > 0 and body["tdee_estimate"] > 0
    assert body["rationale"].startswith("Starting estimate")
    assert body["consumed"] == {"kcal": 0, "protein_g": 0, "carb_g": 0, "fat_g": 0}
    assert body["log_quality"] == 1.0
    assert body["stub"] is True
    saved = [t for t, row in db.writes]
    assert saved == ["targets", "model_outputs"]
    assert db.tables["targets"][0]["effective_date"] == "2026-11-19"
    assert db.tables["model_outputs"][0]["status"] == "insufficient_data"


def test_a_second_call_the_same_day_writes_nothing(client, db, fixed_today):
    seed_user(db, fixed_today)
    first = client.get("/today").json()
    db.writes.clear()

    second = client.get("/today").json()

    assert db.writes == []
    assert second["targets"] == first["targets"]


def test_week_old_targets_are_recalculated(client, db, fixed_today):
    seed_user(db, fixed_today)
    week_ago = (fixed_today - timedelta(days=7)).isoformat()
    db.tables["targets"] = [{"user_id": USER_A, "effective_date": week_ago, "kcal": 1000,
                             "protein_g": 100, "carb_g": 100, "fat_g": 30, "source": "formula"}]

    body = client.get("/today").json()

    assert body["targets"]["kcal"] != 1000
    assert sorted(t["effective_date"] for t in db.tables["targets"]) == [week_ago, "2026-11-19"]


def test_recent_targets_are_kept(client, db, fixed_today):
    seed_user(db, fixed_today)
    db.tables["targets"] = [{"user_id": USER_A, "effective_date": "2026-11-16", "kcal": 2200,
                             "protein_g": 150, "carb_g": 230, "fat_g": 70, "tdee_estimate": 2700,
                             "source": "adaptive", "rationale": "Weight trend fell 0.5 kg."}]
    db.tables["food_log_entries"] = [log(USER_A, "2026-11-19", 600, 40, 60, 20)]

    body = client.get("/today").json()

    assert db.writes == []
    assert body["target_source"] == "adaptive"
    assert body["remaining"] == {"kcal": 1600, "protein_g": 110, "carb_g": 170, "fat_g": 50}


def test_consumed_sums_known_values_only(client, db, fixed_today):
    seed_user(db, fixed_today)
    db.tables["food_log_entries"] = [
        log(USER_A, "2026-11-19", 150, 10, 20, 5),   # 150 g of a 100 kcal/100 g food
        log(USER_A, "2026-11-19", None),             # unknown kcal
        log(USER_A, "2026-11-18", 900),              # yesterday
    ]

    body = client.get("/today").json()

    assert body["consumed"]["kcal"] == 150
    assert body["log_quality"] == 0.5


def test_never_returns_another_users_logs(client, db, fixed_today):
    seed_user(db, fixed_today)
    db.tables["food_log_entries"] = [log(USER_B, "2026-11-19", 5000)]

    assert client.get("/today").json()["consumed"]["kcal"] == 0


def test_incomplete_profile_without_targets_is_422(client, db, fixed_today):
    seed_user(db, fixed_today, birth_date=None)

    response = client.get("/today")

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "profile_incomplete"
    assert "birth_date" in response.json()["error"]["message"]
    assert db.writes == []


def test_no_weigh_in_is_422(client, db, fixed_today):
    db.tables["profiles"] = [complete_profile()]

    response = client.get("/today")

    assert response.status_code == 422
    assert "weigh_in" in response.json()["error"]["message"]


def test_incomplete_profile_keeps_existing_targets(client, db, fixed_today):
    seed_user(db, fixed_today, birth_date=None)
    db.tables["targets"] = [{"user_id": USER_A, "effective_date": "2026-11-01", "kcal": 2000,
                             "protein_g": 150, "carb_g": 200, "fat_g": 60, "source": "formula"}]

    body = client.get("/today").json()

    assert body["targets"]["kcal"] == 2000


def test_a_past_date_never_writes_targets(client, db, fixed_today):
    seed_user(db, fixed_today)

    body = client.get("/today", params={"date": "2026-11-10"}).json()

    assert body["date"] == "2026-11-10"
    assert body["target_source"] == "none"
    assert body["targets"] is None and body["remaining"] is None
    assert db.writes == []


def test_without_a_service_key_targets_are_returned_but_not_saved(client, db, fixed_today):
    from main import app
    from routers import today

    seed_user(db, fixed_today)
    app.dependency_overrides[today.get_service_db] = lambda: None

    body = client.get("/today").json()

    assert body["target_source"] == "formula"
    assert db.writes == []


def test_history_feeds_the_model(client, db, fixed_today):
    """Three weeks of steady logs and a falling weight move the estimate off the formula."""
    seed_user(db, fixed_today)
    db.tables["body_metrics"] = []
    db.tables["food_log_entries"] = []
    for n in range(1, 29):
        day = (fixed_today - timedelta(days=n)).isoformat()
        db.tables["food_log_entries"].append(log(USER_A, day, 2200))
        db.tables["body_metrics"].append({"user_id": USER_A, "date": day, "weight_kg": 82.0 - (28 - n) * 0.03})

    body = client.get("/today").json()

    assert body["target_source"] == "adaptive"
    assert body["rationale"].startswith("Weight trend fell")
    assert db.tables["model_outputs"][0]["status"] in ("learning", "ok")


def test_database_error_is_502(client, db, fixed_today):
    db.fail_reads = True

    response = client.get("/today")

    assert response.status_code == 502
    assert response.json()["error"]["code"] == "database_error"


def test_missing_token_is_401():
    from fastapi.testclient import TestClient

    from main import app

    response = TestClient(app).get("/today")

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "unauthorized"
