
import os
from pathlib import Path

from dotenv import load_dotenv
from supabase import create_client


# Load environment variables from backend/.env
env_path = Path(__file__).resolve().parent / ".env"
load_dotenv(dotenv_path=env_path, override=True)


# Supabase configuration
url = os.getenv("SUPABASE_URL")
key = os.getenv("SUPABASE_KEY")
service_role_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

# Separate secret used to authorize the nightly recompute endpoint
recompute_api_secret = os.getenv("RECOMPUTE_API_SECRET")


# Validate required environment variables
if not url or not key:
    raise RuntimeError(
        "SUPABASE_URL and SUPABASE_KEY are required in backend/.env"
    )

if not service_role_key:
    raise RuntimeError(
        "SUPABASE_SERVICE_ROLE_KEY is missing from backend/.env"
    )

if not recompute_api_secret:
    raise RuntimeError(
        "RECOMPUTE_API_SECRET is missing from backend/.env"
    )


# Create Supabase clients
supabase = create_client(url, key)

# Backend-only client with elevated database permissions
service_supabase = create_client(url, service_role_key)
