"""Scanner module for discovering video files and smart folders."""

import os
import time
from pathlib import Path
from typing import List, Dict, Any, Optional, Set
from fileforge.media import VIDEO_EXTENSIONS
from fileforge.security import validate_path_safety


class MediaScanner:
    def __init__(self):
        self._cache: Dict[str, Any] = {}
        self._cache_time: float = 0.0
        self._cache_ttl: float = 5.0  # 5 seconds cache TTL

    def scan_videos(
        self,
        base_dir: Path,
        sub_path: str = "",
        search: Optional[str] = None,
        sort_by: str = "name",
        sort_order: str = "asc",
        folder_filter: Optional[str] = None
    ) -> Dict[str, Any]:
        """Scan storage directory for video files without blocking event loop."""
        target_dir = validate_path_safety(base_dir, sub_path)
        if not target_dir.is_dir():
            return {"videos": [], "folders": [], "total": 0}

        cache_key = f"{base_dir}:{sub_path}"
        now = time.time()

        if cache_key in self._cache and (now - self._cache.get(f"{cache_key}_time", 0)) < self._cache_ttl:
            all_videos = self._cache[cache_key]["videos"]
            smart_folders = self._cache[cache_key]["folders"]
        else:
            all_videos = []
            smart_folders_set: Set[str] = set()

            for root, dirs, files in os.walk(target_dir):
                # Skip hidden folders
                dirs[:] = [d for d in dirs if not d.startswith('.')]
                
                # Check for video files in current root
                root_path = Path(root)
                has_video = False

                for f in files:
                    if f.startswith('.'):
                        continue
                    ext = Path(f).suffix.lower()
                    if ext in VIDEO_EXTENSIONS:
                        has_video = True
                        full_p = root_path / f
                        try:
                            rel_p = str(full_p.relative_to(base_dir)).replace('\\', '/')
                            folder_rel = str(root_path.relative_to(base_dir)).replace('\\', '/')
                            if folder_rel == ".":
                                folder_rel = ""
                            
                            folder_display = folder_rel.split('/')[-1] if folder_rel else "Root"

                            stat = full_p.stat()
                            mime_type = "video/mp4"
                            if ext == ".webm":
                                mime_type = "video/webm"
                            elif ext == ".mkv":
                                mime_type = "video/x-matroska"
                            elif ext == ".avi":
                                mime_type = "video/x-msvideo"
                            elif ext in [".mov", ".m4v"]:
                                mime_type = "video/quicktime"

                            video_item = {
                                "name": full_p.name,
                                "title": full_p.stem.replace('_', ' ').replace('.', ' '),
                                "path": rel_p,
                                "is_dir": False,
                                "size": stat.st_size,
                                "mtime": int(stat.st_mtime),
                                "extension": ext,
                                "mime_type": mime_type,
                                "folder_path": folder_rel,
                                "folder": folder_display,
                            }
                            all_videos.append(video_item)
                        except Exception:
                            continue

                if has_video:
                    rel_f = str(root_path.relative_to(base_dir)).replace('\\', '/')
                    if rel_f and rel_f != ".":
                        top_folder = rel_f.split('/')[0]
                        smart_folders_set.add(top_folder)

            smart_folders = sorted(list(smart_folders_set))
            self._cache[cache_key] = {"videos": all_videos, "folders": smart_folders}
            self._cache[f"{cache_key}_time"] = now

        # Apply filtering
        filtered = list(all_videos)

        if folder_filter:
            ff_lower = folder_filter.lower()
            filtered = [
                v for v in filtered
                if v["folder"].lower() == ff_lower or v["folder_path"].lower().startswith(ff_lower)
            ]

        if search:
            s_lower = search.lower()
            filtered = [v for v in filtered if s_lower in v["name"].lower() or s_lower in v["title"].lower()]

        # Sorting
        reverse = (sort_order.lower() == "desc")
        if sort_by == "size":
            filtered.sort(key=lambda x: x["size"], reverse=reverse)
        elif sort_by == "mtime" or sort_by == "date":
            filtered.sort(key=lambda x: x["mtime"], reverse=reverse)
        else:  # name / default
            filtered.sort(key=lambda x: x["name"].lower(), reverse=reverse)

        return {
            "videos": filtered,
            "folders": smart_folders,
            "total": len(filtered)
        }

    def clear_cache(self):
        self._cache.clear()


scanner = MediaScanner()
