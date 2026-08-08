"""Auth service for managing authentication and session validation."""

from typing import Optional
from fastapi import Request, HTTPException, status
from fileforge.database import db
from fileforge.config import settings


class AuthService:
    @staticmethod
    def is_authenticated(request: Request) -> bool:
        if not db.is_auth_enabled() and settings.auth_password is None:
            return True

        # Check authorization header
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ", 1)[1]
            if db.validate_session(token):
                return True

        # Check cookie
        cookie_token = request.cookies.get("fileforge_session")
        if cookie_token and db.validate_session(cookie_token):
            return True

        return False

    @staticmethod
    def require_auth(request: Request):
        if not AuthService.is_authenticated(request):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication required"
            )
