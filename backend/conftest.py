"""
Root conftest: add the backend directory to sys.path so test files
can import backend modules the same way the backend itself does
(e.g. `from main import app` rather than `from backend.main import app`).
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
