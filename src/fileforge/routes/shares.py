"""Share link API routes."""

import mimetypes
from typing import Optional, List
from pathlib import Path
from fastapi import APIRouter, Depends, Request, HTTPException, status, Query, Response
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel

from fileforge.config import settings
from fileforge.security import validate_path_safety
from fileforge.database import db
from fileforge.services.auth import AuthService
from fileforge.services.shares import ShareService
from fileforge.services.storage import StorageService
from fileforge.routes.files import range_requests_response


router = APIRouter(prefix="/api/shares", tags=["shares"])


class CreateShareRequest(BaseModel):
    path: str
    password: Optional[str] = None
    expires_in_seconds: Optional[int] = None
    max_hits: Optional[int] = None

class ShareAccessRequest(BaseModel):
    password: Optional[str] = None


@router.post("/create")
def create_share(req: CreateShareRequest, request: Request):
    AuthService.require_auth(request)
    # Ensure path exists
    target = validate_path_safety(settings.root_dir, req.path)
    if not target.exists():
        raise HTTPException(status_code=404, detail="Path does not exist")

    share_info = db.create_share(
        path=req.path,
        password=req.password,
        expires_in_seconds=req.expires_in_seconds,
        max_hits=req.max_hits
    )
    return share_info


@router.get("/list")
def list_shares(request: Request):
    AuthService.require_auth(request)
    return {"shares": db.list_shares()}


@router.delete("/revoke/{share_id}")
def revoke_share(share_id: str, request: Request):
    AuthService.require_auth(request)
    success = db.revoke_share(share_id)
    if not success:
        raise HTTPException(status_code=404, detail="Share not found")
    return {"status": "success"}


@router.get("/access/{share_id}")
def get_share_info(share_id: str, password: Optional[str] = Query(None)):
    share = ShareService.get_valid_share(share_id, password=password)
    target = validate_path_safety(settings.root_dir, share["path"])
    is_dir = target.is_dir()
    
    return {
        "id": share["id"],
        "path": share["path"],
        "name": target.name or "Root",
        "is_dir": is_dir,
        "has_password": bool(share["password_hash"]),
        "created_at": share["created_at"],
        "expires_at": share["expires_at"]
    }


@router.get("/download/{share_id}")
def download_shared_item(
    request: Request,
    share_id: str,
    password: Optional[str] = Query(None),
    sub_path: Optional[str] = Query(None)
):
    share = ShareService.get_valid_share(share_id, password=password)
    shared_target = validate_path_safety(settings.root_dir, share["path"])
    
    if not shared_target.exists():
        raise HTTPException(status_code=404, detail="Shared item no longer exists")

    if shared_target.is_dir():
        if sub_path:
            target_file = validate_path_safety(shared_target, sub_path)
        else:
            # Download folder as zip
            storage = StorageService(settings.root_dir)
            zip_path = storage.create_zip([share["path"]])
            return FileResponse(
                path=zip_path,
                filename=f"{shared_target.name or 'folder'}.zip",
                media_type="application/zip"
            )
    else:
        target_file = shared_target

    mime_type = mimetypes.guess_type(target_file.name)[0] or "application/octet-stream"
    return range_requests_response(request, target_file, mime_type)
