
import os
from pathlib import Path
from dotenv import load_dotenv
from supabase import create_client

env_path = Path(__file__).resolve().parent / ".env"
load_dotenv(dotenv_path=env_path, override=True)

url = os.getenv("SUPABASE_URL")
key = os.getenv("SUPABASE_KEY")

if not url or not key:
    raise RuntimeError(
        f"Missing SUPABASE_URL or SUPABASE_KEY. "
        f"Check that your .env file exists at: {env_path}"
    )

supabase = create_client(url, key)
