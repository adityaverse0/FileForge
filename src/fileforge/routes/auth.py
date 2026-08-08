"""Authentication API routes."""

from fastapi import APIRouter, Response, HTTPException, status, Request
from pydantic import BaseModel

from fileforge.database import db
from fileforge.config import settings
from fileforge.services.auth import AuthService


router = APIRouter(prefix="/api/auth", tags=["auth"])


class LoginRequest(BaseModel):
    password: str

class SetupPasswordRequest(BaseModel):
    password: str


@router.get("/status")
def auth_status(request: Request):
    auth_required = db.is_auth_enabled()
    is_authed = AuthService.is_authenticated(request)
    return {
        "auth_enabled": auth_required,
        "is_authenticated": is_authed
    }


@router.post("/login")
def login(req: LoginRequest, response: Response):
    valid = False
    if settings.auth_password and req.password == settings.auth_password:
        valid = True
    elif db.verify_admin_password(req.password):
        valid = True

    if not valid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid password"
        )

    token = db.create_session()
    response.set_cookie(
        key="fileforge_session",
        value=token,
        httponly=True,
        samesite="lax",
        max_age=86400 * 7
    )
    return {"status": "success", "token": token}


@router.post("/logout")
def logout(request: Request, response: Response):
    cookie_token = request.cookies.get("fileforge_session")
    if cookie_token:
        db.delete_session(cookie_token)
    response.delete_cookie("fileforge_session")
    return {"status": "success"}


@router.post("/setup")
def setup_password(req: SetupPasswordRequest):
    if db.is_auth_enabled() or settings.auth_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password is already set up"
        )
    if not req.password or len(req.password) < 4:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 4 characters"
        )

    db.set_admin_password(req.password)
    token = db.create_session()
    return {"status": "success", "token": token}
