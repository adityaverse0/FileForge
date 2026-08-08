import pytest
from pathlib import Path
from fileforge.database import Database

def test_auth_and_session(tmp_path):
    db_file = tmp_path / "test.db"
    db = Database(db_file)

    db.set_admin_password("supersecret")
    assert db.verify_admin_password("supersecret") is True
    assert db.verify_admin_password("wrong") is False

    token = db.create_session()
    assert db.validate_session(token) is True
    db.delete_session(token)
    assert db.validate_session(token) is False

def test_shares_management(tmp_path):
    db_file = tmp_path / "test.db"
    db = Database(db_file)

    share = db.create_share("some/file.txt", password="sharepass")
    assert share["id"] is not None
    assert share["has_password"] is True

    fetched = db.get_share(share["id"])
    assert fetched["path"] == "some/file.txt"

    assert db.revoke_share(share["id"]) is True
    assert db.get_share(share["id"]) is None
