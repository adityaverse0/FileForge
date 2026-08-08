"""Storage stats API routes."""

from fastapi import APIRouter, Request
from fileforge.config import settings
from fileforge.services.storage import StorageService
from fileforge.services.auth import AuthService

router = APIRouter(prefix="/api/storage", tags=["storage"])


@router.get("/info")
def storage_info(request: Request):
    AuthService.require_auth(request)
    storage = StorageService(settings.root_dir)
    return storage.get_storage_info()
