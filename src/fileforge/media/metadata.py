"""Metadata module for extracting video details using ffprobe or fallback metadata."""

import shutil
import subprocess
import json
from pathlib import Path
from typing import Dict, Any, Optional
from fileforge.security import validate_path_safety


def get_video_metadata(base_dir: Path, relative_path: str) -> Dict[str, Any]:
    """Extract metadata for a video file, falling back gracefully if ffprobe is absent."""
    file_path = validate_path_safety(base_dir, relative_path)
    if not file_path.is_file():
        return {}

    stat = file_path.stat()
    ext = file_path.suffix.lower()

    mime_type = "video/mp4"
    if ext == ".webm":
        mime_type = "video/webm"
    elif ext == ".mkv":
        mime_type = "video/x-matroska"
    elif ext == ".avi":
        mime_type = "video/x-msvideo"
    elif ext in [".mov", ".m4v"]:
        mime_type = "video/quicktime"

    meta: Dict[str, Any] = {
        "filename": file_path.name,
        "path": relative_path.replace('\\', '/'),
        "size": stat.st_size,
        "mtime": int(stat.st_mtime),
        "mime_type": mime_type,
        "extension": ext,
        "duration": None,
        "width": None,
        "height": None,
        "resolution": None,
        "fps": None,
        "video_codec": None,
        "audio_codec": None,
    }

    # Try ffprobe if available
    ffprobe_bin = shutil.which("ffprobe")
    if ffprobe_bin:
        try:
            cmd = [
                ffprobe_bin,
                "-v", "quiet",
                "-print_format", "json",
                "-show_format",
                "-show_streams",
                str(file_path)
            ]
            res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=5)
            if res.returncode == 0:
                data = json.loads(res.stdout)
                fmt = data.get("format", {})
                if "duration" in fmt:
                    try:
                        meta["duration"] = float(fmt["duration"])
                    except ValueError:
                        pass

                streams = data.get("streams", [])
                for stream in streams:
                    codec_type = stream.get("codec_type")
                    if codec_type == "video" and meta["video_codec"] is None:
                        meta["video_codec"] = stream.get("codec_name")
                        if "width" in stream and "height" in stream:
                            meta["width"] = stream["width"]
                            meta["height"] = stream["height"]
                            meta["resolution"] = f"{stream['width']}x{stream['height']}"

                        r_frame_rate = stream.get("r_frame_rate", "")
                        if "/" in r_frame_rate:
                            try:
                                num, den = r_frame_rate.split("/")
                                if float(den) > 0:
                                    meta["fps"] = round(float(num) / float(den), 2)
                            except Exception:
                                pass
                    elif codec_type == "audio" and meta["audio_codec"] is None:
                        meta["audio_codec"] = stream.get("codec_name")
        except Exception:
            pass

    return meta
