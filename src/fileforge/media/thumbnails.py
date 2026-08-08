"""Thumbnails module for non-blocking video thumbnail generation and caching."""

import os
import shutil
import hashlib
import subprocess
from pathlib import Path
from typing import Optional
from concurrent.futures import ThreadPoolExecutor
from fileforge.config import settings
from fileforge.security import validate_path_safety

executor = ThreadPoolExecutor(max_workers=2)


def get_cache_dir() -> Path:
    cache_dir = settings.db_path.parent / "thumbnails"
    cache_dir.mkdir(parents=True, exist_ok=True)
    return cache_dir


def _generate_ffmpeg_thumb(video_path: Path, thumb_path: Path):
    """Generate single JPEG frame thumbnail using ffmpeg."""
    ffmpeg_bin = shutil.which("ffmpeg")
    if not ffmpeg_bin:
        return

    try:
        cmd = [
            ffmpeg_bin,
            "-y",
            "-ss", "00:00:05",
            "-i", str(video_path),
            "-vframes", "1",
            "-vf", "scale=480:-1",
            "-q:v", "4",
            str(thumb_path)
        ]
        res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=8)
        if res.returncode != 0 or not thumb_path.exists() or thumb_path.stat().st_size == 0:
            # Retry at 00:00:01 if 5s fails
            cmd_retry = [
                ffmpeg_bin,
                "-y",
                "-ss", "00:00:01",
                "-i", str(video_path),
                "-vframes", "1",
                "-vf", "scale=480:-1",
                "-q:v", "4",
                str(thumb_path)
            ]
            subprocess.run(cmd_retry, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=8)
    except Exception:
        if thumb_path.exists():
            try:
                thumb_path.unlink()
            except Exception:
                pass


def get_video_thumbnail(base_dir: Path, relative_path: str) -> Optional[Path]:
    """Retrieve or generate cached video thumbnail file path."""
    try:
        video_path = validate_path_safety(base_dir, relative_path)
        if not video_path.is_file():
            return None
    except Exception:
        return None

    path_hash = hashlib.md5(f"{relative_path}:{video_path.stat().st_mtime}".encode()).hexdigest()
    thumb_path = get_cache_dir() / f"{path_hash}.jpg"

    if thumb_path.exists() and thumb_path.stat().st_size > 0:
        return thumb_path

    # Check if ffmpeg is available
    if not shutil.which("ffmpeg"):
        return None

    # Queue non-blocking thumbnail generation if missing
    executor.submit(_generate_ffmpeg_thumb, video_path, thumb_path)
    return None
