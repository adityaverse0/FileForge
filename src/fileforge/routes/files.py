"""File operations API endpoints."""

import os
import shutil
import mimetypes
from typing import List, Optional
from pathlib import Path
from fastapi import (
    APIRouter, Depends, Request, UploadFile, File, Form, Query, HTTPException, status, Response
)
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel

from fileforge.config import settings
from fileforge.security import validate_path_safety
from fileforge.services.storage import StorageService
from fileforge.services.auth import AuthService


router = APIRouter(prefix="/api/files", tags=["files"])


class CreateFolderRequest(BaseModel):
    path: str = ""
    name: str

class RenameRequest(BaseModel):
    path: str
    new_name: str

class MultiPathRequest(BaseModel):
    paths: List[str]

class CopyMoveRequest(BaseModel):
    paths: List[str]
    dest_dir: str


def get_storage_service() -> StorageService:
    return StorageService(settings.root_dir)


@router.get("/list")
def list_files(
    request: Request,
    path: str = Query("", description="Relative path in storage"),
    search: Optional[str] = Query(None),
    sort_by: str = Query("name"),
    sort_order: str = Query("asc"),
    show_hidden: bool = Query(False, description="Include Unix hidden files starting with ."),
    storage: StorageService = Depends(get_storage_service)
):
    AuthService.require_auth(request)
    return storage.list_directory(
        sub_path=path,
        search=search,
        sort_by=sort_by,
        sort_order=sort_order,
        show_hidden=show_hidden
    )


@router.post("/create-folder")
def create_folder(
    req: CreateFolderRequest,
    request: Request,
    storage: StorageService = Depends(get_storage_service)
):
    AuthService.require_auth(request)
    return storage.create_folder(req.path, req.name)


@router.post("/upload")
async def upload_files(
    request: Request,
    path: str = Form(""),
    files: List[UploadFile] = File(...),
    storage: StorageService = Depends(get_storage_service)
):
    AuthService.require_auth(request)
    target_dir = validate_path_safety(storage.base_dir, path)
    if not target_dir.is_dir():
        raise HTTPException(status_code=400, detail="Target directory does not exist")

    uploaded = []
    for file in files:
        if not file.filename:
            continue
        # Sanitize filename
        safe_filename = Path(file.filename).name
        dest_path = validate_path_safety(target_dir, safe_filename)
        
        # Stream upload to file to handle large files efficiently
        with open(dest_path, "wb") as buffer:
            while chunk := await file.read(1024 * 1024):  # 1MB chunks
                buffer.write(chunk)
        uploaded.append(safe_filename)

    return {"status": "success", "uploaded": uploaded}


def range_requests_response(request: Request, file_path: Path, content_type: str):
    """Handles HTTP Range requests for streaming video/audio and large files."""
    file_size = file_path.stat().st_size
    range_header = request.headers.get("Range")

    if not range_header:
        return FileResponse(
            path=file_path,
            media_type=content_type,
            filename=file_path.name,
            headers={"Accept-Ranges": "bytes", "Content-Length": str(file_size)}
        )

    try:
        units, range_str = range_header.split("=")
        if units.strip() != "bytes":
            raise ValueError()
        start_str, end_str = range_str.split("-")
        start = int(start_str) if start_str else 0
        end = int(end_str) if end_str else file_size - 1
        if start >= file_size or end >= file_size or start > end:
            raise ValueError()
    except Exception:
        return Response(
            status_code=416,
            headers={"Content-Range": f"bytes */{file_size}"}
        )

    chunk_size = (end - start) + 1

    def stream_bytes():
        with open(file_path, "rb") as f:
            f.seek(start)
            bytes_left = chunk_size
            while bytes_left > 0:
                read_size = min(1024 * 64, bytes_left)  # 64KB per read
                chunk = f.read(read_size)
                if not chunk:
                    break
                bytes_left -= len(chunk)
                yield chunk

    headers = {
        "Content-Range": f"bytes {start}-{end}/{file_size}",
        "Accept-Ranges": "bytes",
        "Content-Length": str(chunk_size),
        "Content-Type": content_type,
        "Content-Disposition": f'inline; filename="{file_path.name}"'
    }

    return StreamingResponse(
        stream_bytes(),
        status_code=206,
        headers=headers
    )


@router.get("/download")
def download_file(
    request: Request,
    path: str = Query(...),
    storage: StorageService = Depends(get_storage_service)
):
    AuthService.require_auth(request)
    target_path = validate_path_safety(storage.base_dir, path)
    if target_path.is_dir():
        # Zip folder on download
        zip_path = storage.create_zip([path])
        return FileResponse(
            path=zip_path,
            filename=f"{target_path.name or 'folder'}.zip",
            media_type="application/zip"
        )

    mime_type = mimetypes.guess_type(target_path.name)[0] or "application/octet-stream"
    return range_requests_response(request, target_path, mime_type)


@router.get("/preview")
def preview_file(
    request: Request,
    path: str = Query(...),
    storage: StorageService = Depends(get_storage_service)
):
    AuthService.require_auth(request)
    target_path = validate_path_safety(storage.base_dir, path)
    if not target_path.exists() or target_path.is_dir():
        raise HTTPException(status_code=404, detail="File not found")

    mime_type = mimetypes.guess_type(target_path.name)[0] or "application/octet-stream"

    # Text content reading helper for previews
    if mime_type.startswith("text/") or target_path.suffix in [
        ".txt", ".py", ".json", ".js", ".css", ".html", ".md", ".yml", ".yaml", ".sh", ".c", ".cpp", ".h"
    ]:
        try:
            with open(target_path, "r", encoding="utf-8", errors="replace") as f:
                content = f.read(50000)  # Read up to 50KB for text preview
            return {
                "type": "text",
                "name": target_path.name,
                "content": content,
                "mime_type": mime_type
            }
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Cannot read text file: {str(e)}")

    # Return Range response for streaming media or direct file stream
    return range_requests_response(request, target_path, mime_type)


@router.post("/rename")
def rename_item(
    req: RenameRequest,
    request: Request,
    storage: StorageService = Depends(get_storage_service)
):
    AuthService.require_auth(request)
    return storage.rename_path(req.path, req.new_name)


@router.post("/delete")
def delete_items(
    req: MultiPathRequest,
    request: Request,
    storage: StorageService = Depends(get_storage_service)
):
    AuthService.require_auth(request)
    deleted = storage.delete_paths(req.paths)
    return {"status": "success", "deleted": deleted}


@router.post("/copy")
def copy_items(
    req: CopyMoveRequest,
    request: Request,
    storage: StorageService = Depends(get_storage_service)
):
    AuthService.require_auth(request)
    copied = storage.copy_paths(req.paths, req.dest_dir)
    return {"status": "success", "copied": copied}


@router.post("/move")
def move_items(
    req: CopyMoveRequest,
    request: Request,
    storage: StorageService = Depends(get_storage_service)
):
    AuthService.require_auth(request)
    moved = storage.move_paths(req.paths, req.dest_dir)
    return {"status": "success", "moved": moved}


@router.post("/zip")
def zip_items(
    req: MultiPathRequest,
    request: Request,
    storage: StorageService = Depends(get_storage_service)
):
    AuthService.require_auth(request)
    if not req.paths:
        raise HTTPException(status_code=400, detail="No paths provided for ZIP")
    zip_path = storage.create_zip(req.paths)
    return FileResponse(
        path=zip_path,
        filename="archive.zip",
        media_type="application/zip"
    )


@router.get("/recent")
def recent_files(
    request: Request,
    limit: int = Query(20),
    storage: StorageService = Depends(get_storage_service)
):
    AuthService.require_auth(request)
    return {"items": storage.get_recent_files(limit=limit)}
