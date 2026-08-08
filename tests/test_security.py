import pytest
from pathlib import Path
from fastapi import HTTPException
from fileforge.security import validate_path_safety, hash_password, verify_password, generate_token

def test_safe_path_resolution(tmp_path):
    root = tmp_path / "root"
    root.mkdir()
    file_a = root / "file.txt"
    file_a.write_text("hello")

    res = validate_path_safety(root, "file.txt")
    assert res == file_a.resolve()

def test_path_traversal_blocked(tmp_path):
    root = tmp_path / "root"
    root.mkdir()
    outside = tmp_path / "secret.txt"
    outside.write_text("secret")

    with pytest.raises(HTTPException) as exc_info:
        validate_path_safety(root, "../secret.txt")
    assert exc_info.value.status_code == 403

def test_encoded_traversal_blocked(tmp_path):
    root = tmp_path / "root"
    root.mkdir()

    with pytest.raises(HTTPException) as exc_info:
        validate_path_safety(root, "%2e%2e/secret.txt")
    assert exc_info.value.status_code in [403, 404]

def test_password_hashing():
    pwd = "mysecretpassword123"
    hash_hex, salt_hex = hash_password(pwd)
    assert verify_password(pwd, hash_hex, salt_hex) is True
    assert verify_password("wrongpassword", hash_hex, salt_hex) is False

def test_token_generation():
    t1 = generate_token()
    t2 = generate_token()
    assert len(t1) > 20
    assert t1 != t2
