"""Test setup: dummy Supabase settings and an in-memory stand-in for the Supabase client.

FakeDB stores rows per table and supports the query methods the routes use. It does not
enforce RLS; the routes also filter by user_id, and the tests check that filter.
"""

import os
import sys
from datetime import date
from pathlib import Path
from types import SimpleNamespace

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
os.environ.setdefault("SUPABASE_URL", "http://localhost:54321")
os.environ.setdefault("SUPABASE_KEY", "test-anon-key")


class Result:
    def __init__(self, data):
        self.data = data


class Query:
    def __init__(self, db, table):
        self.db, self.table = db, table
        self.filters, self.orders = [], []
        self.limit_n = None
        self.offset = 0
        self.upsert_row = None
        self.conflict = None

    def select(self, *_columns):
        return self

    def eq(self, column, value):
        self.filters.append(lambda r: str(r.get(column)) == str(value))
        return self

    def lte(self, column, value):
        self.filters.append(lambda r: str(r.get(column)) <= str(value))
        return self

    def gte(self, column, value):
        self.filters.append(lambda r: str(r.get(column)) >= str(value))
        return self

    def order(self, column, desc=False):
        self.orders.append((column, desc))
        return self

    def limit(self, n):
        self.limit_n = n
        return self

    def range(self, start, end):
        self.offset, self.limit_n = start, end - start + 1
        return self

    def upsert(self, row, on_conflict):
        self.upsert_row, self.conflict = row, on_conflict.split(",")
        return self

    def execute(self):
        if self.db.fail_reads:
            raise RuntimeError("database down")
        rows = self.db.tables.setdefault(self.table, [])
        if self.upsert_row is not None:
            self.db.writes.append((self.table, self.upsert_row))
            key = [self.upsert_row[c] for c in self.conflict]
            rows[:] = [r for r in rows if [r.get(c) for c in self.conflict] != key]
            rows.append(dict(self.upsert_row))
            return Result([self.upsert_row])
        out = [r for r in rows if all(f(r) for f in self.filters)]
        for column, desc in reversed(self.orders):
            out.sort(key=lambda r: str(r.get(column)), reverse=desc)
        out = out[self.offset:]
        if self.limit_n is not None:
            out = out[: self.limit_n]
        self.db.reads += 1
        return Result([dict(r) for r in out])


class FakeDB:
    def __init__(self):
        self.tables: dict[str, list[dict]] = {}
        self.writes: list[tuple[str, dict]] = []
        self.reads = 0
        self.fail_reads = False

    def table(self, name):
        return Query(self, name)


USER_A = "11111111-1111-1111-1111-111111111111"
USER_B = "22222222-2222-2222-2222-222222222222"


def complete_profile(user_id=USER_A, **overrides):
    row = {
        "id": user_id,
        "sex": "male",
        "birth_date": "2002-03-01",
        "height_cm": 180,
        "activity_level": "moderate",
        "goal": "lose",
        "timezone": "America/Detroit",
    }
    row.update(overrides)
    return row


@pytest.fixture
def db():
    return FakeDB()


@pytest.fixture
def service(db):
    """The service-role client writes to the same database the user reads."""
    return db


@pytest.fixture
def client(db, service):
    """A test client signed in as USER_A, reading `db` and writing through `service`."""
    from fastapi.testclient import TestClient

    from auth import get_current_user
    from main import app
    from routers import today

    app.dependency_overrides[get_current_user] = lambda: {
        "user": SimpleNamespace(id=USER_A, email="a@example.com"),
        "token": "test-token",
    }
    app.dependency_overrides[today.get_db] = lambda: db
    app.dependency_overrides[today.get_service_db] = lambda: service
    yield TestClient(app)
    app.dependency_overrides.clear()


@pytest.fixture
def fixed_today(monkeypatch):
    """Pin the user's local today so tests do not depend on the clock."""
    import nutrition

    day = date(2026, 11, 19)
    monkeypatch.setattr(nutrition, "local_today", lambda tz_name, now=None: day)
    return day
