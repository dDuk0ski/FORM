
import os
from pathlib import Path
from dotenv import load_dotenv
from supabase import Client, create_client

env_path = Path(__file__).resolve().parent / ".env"
load_dotenv(dotenv_path=env_path)

url = os.getenv("SUPABASE_URL")
key = os.getenv("SUPABASE_KEY")
service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not url or not key:
    raise RuntimeError(
        f"Missing SUPABASE_URL or SUPABASE_KEY. "
        f"Check that your .env file exists at: {env_path}"
    )

supabase = create_client(url, key)
_service: Client | None = None


def user_client(token: str) -> Client:
    """A client that acts as the signed-in user, so RLS applies to every read."""
    client = create_client(url, key)
    client.postgrest.auth(token)
    return client


def service_client() -> Client | None:
    """The service-role client for backend-only writes (targets, model_outputs).

    None when SUPABASE_SERVICE_ROLE_KEY is not set; callers then skip the write.
    """
    global _service
    if _service is None and service_key:
        _service = create_client(url, service_key)
    return _service
