import pytest
from pathlib import Path
from fileforge.services.storage import StorageService

def test_file_listing_and_folder_creation(tmp_path):
    storage = StorageService(tmp_path)
    
    # Create folder
    folder_info = storage.create_folder("", "test_folder")
    assert folder_info["name"] == "test_folder"
    assert (tmp_path / "test_folder").is_dir()

    # List items
    res = storage.list_directory("")
    assert res["total"] == 1
    assert res["items"][0]["name"] == "test_folder"

def test_rename_delete_copy_move(tmp_path):
    storage = StorageService(tmp_path)
    
    # Create file
    f = tmp_path / "hello.txt"
    f.write_text("content")

    # Rename
    renamed = storage.rename_path("hello.txt", "world.txt")
    assert renamed["name"] == "world.txt"
    assert not (tmp_path / "hello.txt").exists()

    # Copy
    sub = tmp_path / "subdir"
    sub.mkdir()
    copied = storage.copy_paths(["world.txt"], "subdir")
    assert "world.txt" in copied
    assert (sub / "world.txt").exists()

    # Move
    moved = storage.move_paths(["world.txt"], "subdir")
    assert "world.txt" in moved

    # Delete
    deleted = storage.delete_paths(["subdir"])
    assert "subdir" in deleted
    assert not sub.exists()

def test_zip_creation(tmp_path):
    storage = StorageService(tmp_path)
    f1 = tmp_path / "a.txt"
    f2 = tmp_path / "b.txt"
    f1.write_text("A")
    f2.write_text("B")

    zip_file = storage.create_zip(["a.txt", "b.txt"])
    assert zip_file.exists()
    assert zip_file.stat().st_size > 0

def test_hidden_files_filtering(tmp_path):
    storage = StorageService(tmp_path)
    (tmp_path / ".env").write_text("SECRET=123")
    (tmp_path / ".git").mkdir()
    (tmp_path / "visible.txt").write_text("visible")

    # Default (show_hidden=False)
    res_default = storage.list_directory("")
    names_default = [item["name"] for item in res_default["items"]]
    assert "visible.txt" in names_default
    assert ".env" not in names_default
    assert ".git" not in names_default

    # Enabled (show_hidden=True)
    res_hidden = storage.list_directory("", show_hidden=True)
    names_hidden = [item["name"] for item in res_hidden["items"]]
    assert "visible.txt" in names_hidden
    assert ".env" in names_hidden
    assert ".git" in names_hidden
