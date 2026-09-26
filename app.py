"""
VideoFarm AI Studio - Root Application Entrypoint
Proxies to the backend FastAPI application for convenience and backwards-compatibility.
"""
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
BACKEND_DIR = BASE_DIR / "backend"

if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from backend.app import app

__all__ = ["app"]
