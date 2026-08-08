"""Shares service for managing public share links."""

from typing import Optional, Dict, Any
from fastapi import HTTPException, status
from fileforge.database import db
from fileforge.security import verify_password


class ShareService:
    @staticmethod
    def get_valid_share(share_id: str, password: Optional[str] = None) -> Dict[str, Any]:
        share = db.get_share(share_id)
        if not share:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Share link not found or expired"
            )

        if share["password_hash"]:
            if not password:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Share link requires a password"
                )
            if not verify_password(password, share["password_hash"], share["salt_hex"]):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Invalid share password"
                )

        db.increment_share_hits(share_id)
        return share
