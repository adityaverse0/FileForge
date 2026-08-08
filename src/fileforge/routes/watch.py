"""Watch Media Mode API endpoints."""

import mimetypes
from typing import Optional, List, Dict, Any
from pathlib import Path
from fastapi import APIRouter, Depends, Request, Query, HTTPException, status, Response
from fastapi.responses import FileResponse, Response
from pydantic import BaseModel

from fileforge.config import settings
from fileforge.security import validate_path_safety
from fileforge.services.storage import StorageService
from fileforge.services.auth import AuthService
from fileforge.database import db
from fileforge.routes.files import range_requests_response
from fileforge.media.scanner import scanner
from fileforge.media.metadata import get_video_metadata
from fileforge.media.subtitles import discover_subtitles, get_subtitle_content
from fileforge.media.thumbnails import get_video_thumbnail


router = APIRouter(prefix="/api/watch", tags=["watch"])


class ProgressRequest(BaseModel):
    path: str
    position_seconds: float
    duration_seconds: float


class FavoriteRequest(BaseModel):
    path: str


def get_storage_service() -> StorageService:
    return StorageService(settings.root_dir)


@router.get("/videos")
def list_watch_videos(
    request: Request,
    path: str = Query("", description="Subdirectory inside storage root"),
    search: Optional[str] = Query(None),
    sort_by: str = Query("name"),
    sort_order: str = Query("asc"),
    folder: Optional[str] = Query(None),
    favorite_only: bool = Query(False),
    storage: StorageService = Depends(get_storage_service)
):
    """List videos in storage with progress, metadata, and filters."""
    AuthService.require_auth(request)

    res = scanner.scan_videos(
        base_dir=storage.base_dir,
        sub_path=path,
        search=search,
        sort_by=sort_by,
        sort_order=sort_order,
        folder_filter=folder
    )

    videos = res["videos"]
    fav_paths = set(db.list_watch_favorites())

    result_videos = []
    for v in videos:
        is_fav = v["path"] in fav_paths
        if favorite_only and not is_fav:
            continue

        prog = db.get_watch_progress(v["path"])
        v["progress"] = prog
        v["is_favorite"] = is_fav
        result_videos.append(v)

    return {
        "videos": result_videos,
        "folders": res["folders"],
        "total": len(result_videos)
    }


@router.get("/video")
def get_watch_video_details(
    request: Request,
    path: str = Query(...),
    storage: StorageService = Depends(get_storage_service)
):
    """Get rich metadata, progress, and subtitles for a single video file."""
    AuthService.require_auth(request)

    file_path = validate_path_safety(storage.base_dir, path)
    if not file_path.is_file():
        raise HTTPException(status_code=404, detail="Video file not found")

    meta = get_video_metadata(storage.base_dir, path)
    subs = discover_subtitles(storage.base_dir, path)
    prog = db.get_watch_progress(path)
    is_fav = db.is_watch_favorite(path)

    meta["subtitles"] = subs
    meta["progress"] = prog
    meta["is_favorite"] = is_fav

    return meta


@router.get("/stream")
@router.head("/stream")
def stream_watch_video(
    request: Request,
    path: str = Query(...),
    storage: StorageService = Depends(get_storage_service)
):
    """Stream video file with HTTP 206 Partial Content Range support."""
    AuthService.require_auth(request)

    target_path = validate_path_safety(storage.base_dir, path)
    if not target_path.is_file():
        raise HTTPException(status_code=404, detail="Video file not found")

    ext = target_path.suffix.lower()
    mime_type = "video/mp4"
    if ext == ".webm":
        mime_type = "video/webm"
    elif ext == ".mkv":
        mime_type = "video/x-matroska"
    elif ext == ".avi":
        mime_type = "video/x-msvideo"
    elif ext in [".mov", ".m4v"]:
        mime_type = "video/quicktime"

    return range_requests_response(request, target_path, mime_type)


@router.get("/subtitles")
def get_watch_subtitles(
    request: Request,
    path: str = Query(...),
    storage: StorageService = Depends(get_storage_service)
):
    """Serve WebVTT subtitles dynamically."""
    AuthService.require_auth(request)

    content = get_subtitle_content(storage.base_dir, path)
    if content is None:
        raise HTTPException(status_code=404, detail="Subtitle file not found")

    return Response(content=content, media_type="text/vtt; charset=utf-8")


@router.get("/thumbnail")
def get_watch_thumbnail(
    request: Request,
    path: str = Query(...),
    storage: StorageService = Depends(get_storage_service)
):
    """Serve cached video thumbnail JPEG."""
    AuthService.require_auth(request)

    thumb_file = get_video_thumbnail(storage.base_dir, path)
    if not thumb_file or not thumb_file.exists():
        raise HTTPException(status_code=404, detail="Thumbnail unavailable")

    return FileResponse(path=thumb_file, media_type="image/jpeg")


@router.get("/progress")
def list_watch_progress(
    request: Request,
    limit: int = Query(20),
    storage: StorageService = Depends(get_storage_service)
):
    """Get 'Continue Watching' progress list with video metadata."""
    AuthService.require_auth(request)

    prog_list = db.list_watch_progress(limit=limit)
    valid_progress = []

    for item in prog_list:
        try:
            full_path = validate_path_safety(storage.base_dir, item["path"])
            if full_path.is_file():
                item["name"] = full_path.name
                item["title"] = full_path.stem.replace('_', ' ').replace('.', ' ')
                valid_progress.append(item)
        except Exception:
            continue

    return {"progress": valid_progress}


@router.post("/progress")
@router.put("/progress")
def update_watch_progress(
    req: ProgressRequest,
    request: Request,
    storage: StorageService = Depends(get_storage_service)
):
    """Save playback progress position."""
    AuthService.require_auth(request)

    target_path = validate_path_safety(storage.base_dir, req.path)
    if not target_path.is_file():
        raise HTTPException(status_code=404, detail="Video file not found")

    db.save_watch_progress(req.path, req.position_seconds, req.duration_seconds)
    return {"status": "success", "path": req.path}


@router.get("/favorites")
def list_watch_favorites(
    request: Request,
    storage: StorageService = Depends(get_storage_service)
):
    """List favorite video items."""
    AuthService.require_auth(request)

    fav_paths = db.list_watch_favorites()
    fav_videos = []

    for p in fav_paths:
        try:
            full_path = validate_path_safety(storage.base_dir, p)
            if full_path.is_file():
                fav_videos.append({
                    "name": full_path.name,
                    "title": full_path.stem.replace('_', ' ').replace('.', ' '),
                    "path": p,
                    "size": full_path.stat().st_size,
                    "mtime": int(full_path.stat().st_mtime)
                })
        except Exception:
            continue

    return {"favorites": fav_videos}


@router.post("/favorites")
def add_watch_favorite(
    req: FavoriteRequest,
    request: Request,
    storage: StorageService = Depends(get_storage_service)
):
    """Add a video to favorites."""
    AuthService.require_auth(request)

    target_path = validate_path_safety(storage.base_dir, req.path)
    if not target_path.is_file():
        raise HTTPException(status_code=404, detail="Video file not found")

    db.add_watch_favorite(req.path)
    return {"status": "success", "path": req.path, "is_favorite": True}


@router.delete("/favorites")
def remove_watch_favorite(
    req: FavoriteRequest,
    request: Request,
    storage: StorageService = Depends(get_storage_service)
):
    """Remove a video from favorites."""
    AuthService.require_auth(request)

    db.remove_watch_favorite(req.path)
    return {"status": "success", "path": req.path, "is_favorite": False}
