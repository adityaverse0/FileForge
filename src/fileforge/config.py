"""Configuration module for FileForge."""

import os
from pathlib import Path
from typing import Optional


class Settings:
    def __init__(self):
        self.root_dir: Path = Path.cwd().resolve()
        self.host: str = "0.0.0.0"
        self.port: int = 8080
        self.auth_password: Optional[str] = None
        self.db_path: Path = Path.home() / ".fileforge" / "fileforge.db"
        self.secret_key: str = os.urandom(32).hex()

    def set_root_dir(self, path: str):
        p = Path(path).expanduser().resolve()
        if not p.exists():
            p.mkdir(parents=True, exist_ok=True)
        self.root_dir = p

settings = Settings()
