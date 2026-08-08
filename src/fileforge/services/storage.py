"""Storage service for handling filesystem operations safely."""

import os
import shutil
import zipfile
import mimetypes
import tempfile
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple
from fastapi import HTTPException, status
from fileforge.security import validate_path_safety


class StorageService:
    def __init__(self, base_dir: Path):
        self.base_dir = base_dir.resolve()

    def get_path_info(self, target_path: Path) -> Dict[str, Any]:
        """Returns metadata for a file or directory."""
        stat = target_path.stat()
        rel_path = ""
        try:
            rel_path = str(target_path.relative_to(self.base_dir))
            if rel_path == ".":
                rel_path = ""
        except ValueError:
            rel_path = target_path.name

        is_dir = target_path.is_dir()
        mime_type = "inode/directory" if is_dir else (mimetypes.guess_type(target_path.name)[0] or "application/octet-stream")

        return {
            "name": target_path.name or "Root",
            "path": rel_path.replace('\\', '/'),
            "is_dir": is_dir,
            "size": stat.st_size if not is_dir else 0,
            "mtime": int(stat.st_mtime),
            "mime_type": mime_type,
            "extension": target_path.suffix.lower() if not is_dir else "",
        }

    def list_directory(
        self,
        sub_path: str = "",
        search: Optional[str] = None,
        sort_by: str = "name",
        sort_order: str = "asc",
        show_hidden: bool = False
    ) -> Dict[str, Any]:
        """List files in sub_path with optional search, sorting, and hidden file filtering."""
        target_dir = validate_path_safety(self.base_dir, sub_path)
        if not target_dir.is_dir():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Path '{sub_path}' is not a directory"
            )

        items: List[Dict[str, Any]] = []

        if search:
            search_lower = search.lower()
            for root, dirs, files in os.walk(target_dir):
                if not show_hidden:
                    dirs[:] = [d for d in dirs if not d.startswith('.')]
                for name in dirs + files:
                    if not show_hidden and name.startswith('.'):
                        continue
                    if search_lower in name.lower():
                        full_p = Path(root) / name
                        try:
                            items.append(self.get_path_info(full_p))
                        except Exception:
                            continue
        else:
            for entry in os.scandir(target_dir):
                if not show_hidden and entry.name.startswith('.'):
                    continue
                try:
                    items.append(self.get_path_info(Path(entry.path)))
                except Exception:
                    continue

        # Sorting logic
        reverse = (sort_order.lower() == "desc")
        if sort_by == "size":
            items.sort(key=lambda x: (not x["is_dir"], x["size"]), reverse=reverse)
        elif sort_by == "mtime":
            items.sort(key=lambda x: (not x["is_dir"], x["mtime"]), reverse=reverse)
        elif sort_by == "type":
            items.sort(key=lambda x: (not x["is_dir"], x["mime_type"], x["name"].lower()), reverse=reverse)
        else:  # name
            items.sort(key=lambda x: (not x["is_dir"], x["name"].lower()), reverse=reverse)

        # Build breadcrumbs
        rel_current = ""
        try:
            rel_current = str(target_dir.relative_to(self.base_dir)).replace('\\', '/')
            if rel_current == ".":
                rel_current = ""
        except ValueError:
            rel_current = ""

        breadcrumbs = [{"name": "Root", "path": ""}]
        if rel_current:
            parts = rel_current.split('/')
            accumulated = ""
            for part in parts:
                if part:
                    accumulated = f"{accumulated}/{part}" if accumulated else part
                    breadcrumbs.append({"name": part, "path": accumulated})

        return {
            "current_path": rel_current,
            "breadcrumbs": breadcrumbs,
            "items": items,
            "total": len(items)
        }

    def create_folder(self, sub_path: str, folder_name: str) -> Dict[str, Any]:
        if not folder_name or "/" in folder_name or "\\" in folder_name or ".." in folder_name:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid folder name"
            )

        target_dir = validate_path_safety(self.base_dir, sub_path)
        new_folder_path = validate_path_safety(target_dir, folder_name)

        if new_folder_path.exists():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Folder or file '{folder_name}' already exists"
            )

        new_folder_path.mkdir(parents=True, exist_ok=True)
        return self.get_path_info(new_folder_path)

    def rename_path(self, sub_path: str, new_name: str) -> Dict[str, Any]:
        if not new_name or "/" in new_name or "\\" in new_name or ".." in new_name:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid new name"
            )

        target_path = validate_path_safety(self.base_dir, sub_path)
        if target_path == self.base_dir:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot rename root directory"
            )

        destination_path = validate_path_safety(target_path.parent, new_name)
        if destination_path.exists():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Item with name '{new_name}' already exists"
            )

        target_path.rename(destination_path)
        return self.get_path_info(destination_path)

    def delete_paths(self, paths: List[str]) -> List[str]:
        deleted = []
        for p in paths:
            target_path = validate_path_safety(self.base_dir, p)
            if target_path == self.base_dir:
                continue  # Never delete root
            if target_path.exists():
                if target_path.is_dir():
                    shutil.rmtree(target_path)
                else:
                    target_path.unlink()
                deleted.append(p)
        return deleted

    def copy_paths(self, src_paths: List[str], dest_dir: str) -> List[str]:
        target_dest = validate_path_safety(self.base_dir, dest_dir)
        if not target_dest.is_dir():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Destination must be a valid directory"
            )

        copied = []
        for p in src_paths:
            src_path = validate_path_safety(self.base_dir, p)
            if not src_path.exists():
                continue
            dest_item = target_dest / src_path.name
            if src_path.is_dir():
                shutil.copytree(src_path, dest_item, dirs_exist_ok=True)
            else:
                shutil.copy2(src_path, dest_item)
            copied.append(p)
        return copied

    def move_paths(self, src_paths: List[str], dest_dir: str) -> List[str]:
        target_dest = validate_path_safety(self.base_dir, dest_dir)
        if not target_dest.is_dir():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Destination must be a valid directory"
            )

        moved = []
        for p in src_paths:
            src_path = validate_path_safety(self.base_dir, p)
            if not src_path.exists() or src_path == self.base_dir:
                continue
            dest_item = target_dest / src_path.name
            shutil.move(str(src_path), str(dest_item))
            moved.append(p)
        return moved

    def create_zip(self, src_paths: List[str]) -> Path:
        """Create a temporary ZIP file containing specified files/folders safely."""
        temp_zip = tempfile.NamedTemporaryFile(delete=False, suffix=".zip")
        temp_zip.close()

        with zipfile.ZipFile(temp_zip.name, 'w', zipfile.ZIP_DEFLATED) as zf:
            for p in src_paths:
                src_path = validate_path_safety(self.base_dir, p)
                if not src_path.exists():
                    continue

                if src_path.is_dir():
                    for root, dirs, files in os.walk(src_path):
                        for file in files:
                            full_file = Path(root) / file
                            # Arcname relative to parent directory of src_path
                            arcname = full_file.relative_to(src_path.parent)
                            zf.write(full_file, arcname=str(arcname))
                else:
                    zf.write(src_path, arcname=src_path.name)

        return Path(temp_zip.name)

    def get_recent_files(self, limit: int = 20) -> List[Dict[str, Any]]:
        """Get most recently modified files in storage root."""
        recent_items: List[Tuple[float, Path]] = []

        for root, dirs, files in os.walk(self.base_dir):
            for f in files:
                full_p = Path(root) / f
                try:
                    stat = full_p.stat()
                    recent_items.append((stat.st_mtime, full_p))
                except Exception:
                    continue

        recent_items.sort(key=lambda x: x[0], reverse=True)
        result = []
        for mtime, p in recent_items[:limit]:
            try:
                result.append(self.get_path_info(p))
            except Exception:
                continue
        return result

    def get_storage_info(self) -> Dict[str, Any]:
        """Returns total, used, free bytes for disk storage."""
        total, used, free = shutil.disk_usage(self.base_dir)
        percent_used = round((used / total) * 100, 1) if total > 0 else 0
        return {
            "root_path": str(self.base_dir),
            "total_bytes": total,
            "used_bytes": used,
            "free_bytes": free,
            "percent_used": percent_used
        }
