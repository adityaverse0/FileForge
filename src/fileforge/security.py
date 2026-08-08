"""Security module for FileForge.

Handles safe path resolution, path traversal prevention, symlink escape prevention,
password hashing, and secure token generation.
"""

import os
import hashlib
import secrets
import urllib.parse
from pathlib import Path
from typing import Union
from fastapi import HTTPException, status


def normalize_relative_path(path_str: str) -> str:
    """Clean and normalize a user-supplied relative path string."""
    if not path_str:
        return ""
    
    # URL decode to prevent percent-encoded traversal (%2e%2e)
    path_str = urllib.parse.unquote(path_str)
    
    # Strip null bytes and control chars
    path_str = path_str.replace('\x00', '')
    
    # Replace backslashes with forward slashes for cross-platform safety
    path_str = path_str.replace('\\', '/')
    
    # Trim leading slashes and whitespace
    path_str = path_str.lstrip('/')
    
    return path_str



def validate_path_safety(base_dir: Union[str, Path], sub_path: str) -> Path:
    """
    Safely resolves base_dir / sub_path ensuring no directory traversal,
    symlink escape, or unauthorized access outside base_dir.
    
    Raises HTTPException 403 or 400 on invalid or unsafe paths.
    """
    base_path = Path(base_dir).resolve()
    if not base_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Storage root directory '{base_dir}' does not exist"
        )
    
    clean_sub = normalize_relative_path(sub_path)
    
    # Combine base and sub_path
    target_path = (base_path / clean_sub).resolve()
    
    # Ensure resolved absolute path starts with resolved base_path
    try:
        # relative_to will raise ValueError if target_path is not under base_path
        target_path.relative_to(base_path)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: Path traversal detected outside storage root"
        )
        
    # Check symlinks recursively to prevent symlink escape
    curr = base_path / clean_sub
    # Check if target exists or parent exists
    check_target = curr if curr.exists() else curr.parent
    try:
        real_check = check_target.resolve(strict=False)
        real_check.relative_to(base_path)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: Symlink points outside storage root"
        )
        
    return target_path


def hash_password(password: str, salt: bytes = None) -> tuple[str, str]:
    """Hash a password using PBKDF2 with SHA-256."""
    if salt is None:
        salt = secrets.token_bytes(16)
    
    key = hashlib.pbkdf2_hmac(
        'sha256',
        password.encode('utf-8'),
        salt,
        100000
    )
    return key.hex(), salt.hex()


def verify_password(password: str, hash_hex: str, salt_hex: str) -> bool:
    """Verify password against salt and hash."""
    try:
        salt = bytes.fromhex(salt_hex)
        key, _ = hash_password(password, salt)
        return secrets.compare_digest(key, hash_hex)
    except Exception:
        return False


def generate_token() -> str:
    """Generate a cryptographically secure random session token."""
    return secrets.token_urlsafe(32)
