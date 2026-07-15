"""API key management and validation"""
import secrets
import hashlib
from datetime import datetime
from typing import Optional, Tuple
from sqlalchemy.orm import Session

from src.core.logger import setup_logger
from src.models import APIKey, User
from src.security.rbac import UserRole

logger = setup_logger(__name__)


class APIKeyManager:
    """Manages API key generation, storage, and validation"""

    @staticmethod
    def generate_key() -> str:
        """Generate a cryptographically secure API key with sk_ prefix"""
        random_bytes = secrets.token_bytes(32)
        return f"sk_{secrets.token_urlsafe(32)}"

    @staticmethod
    def hash_key(key: str) -> str:
        """Hash API key for secure storage"""
        return hashlib.sha256(key.encode()).hexdigest()

    @staticmethod
    def create_api_key(
        db: Session,
        user_id: str,
        name: str = None,
        requests_per_minute: int = 60
    ) -> Tuple[str, APIKey]:
        """
        Create new API key for user

        Args:
            db: Database session
            user_id: User ID to associate with key
            name: Optional key name for reference
            requests_per_minute: Rate limit for this key

        Returns:
            Tuple of (raw_key, api_key_model)
        """
        user = db.query(User).filter_by(user_id=user_id).first()
        if not user:
            raise ValueError(f"User {user_id} not found")

        raw_key = APIKeyManager.generate_key()
        key_hash = APIKeyManager.hash_key(raw_key)

        api_key = APIKey(
            user_id=user_id,
            key_hash=key_hash,
            name=name or f"Key for {user_id}",
            requests_per_minute=requests_per_minute,
            active=True
        )

        db.add(api_key)
        db.commit()
        db.refresh(api_key)

        logger.info(f"Created API key '{api_key.name}' for user {user_id}")
        return raw_key, api_key

    @staticmethod
    def validate_api_key(db: Session, key: str) -> Optional[Tuple[APIKey, User]]:
        """
        Validate API key and return associated user

        Args:
            db: Database session
            key: Raw API key from header

        Returns:
            Tuple of (api_key_model, user_model) if valid, else None
        """
        key_hash = APIKeyManager.hash_key(key)
        api_key = db.query(APIKey).filter_by(
            key_hash=key_hash,
            active=True
        ).first()

        if not api_key:
            logger.warning(f"Invalid or inactive API key attempted")
            return None

        if api_key.revoked_at:
            logger.warning(f"Revoked API key attempted: {api_key.id}")
            return None

        user = db.query(User).filter_by(user_id=api_key.user_id).first()
        if not user or not user.active:
            logger.warning(f"API key user inactive or not found: {api_key.user_id}")
            return None

        # Update last_used_at
        api_key.last_used_at = datetime.utcnow()
        db.commit()

        return api_key, user

    @staticmethod
    def revoke_api_key(db: Session, key_id: int) -> bool:
        """
        Revoke an API key

        Args:
            db: Database session
            key_id: API key ID to revoke

        Returns:
            True if successful, False otherwise
        """
        api_key = db.query(APIKey).filter_by(id=key_id).first()
        if not api_key:
            return False

        api_key.revoked_at = datetime.utcnow()
        api_key.active = False
        db.commit()

        logger.info(f"Revoked API key {key_id}")
        return True

    @staticmethod
    def list_user_keys(db: Session, user_id: str):
        """List all API keys for a user"""
        return db.query(APIKey).filter_by(user_id=user_id).all()

    @staticmethod
    def delete_api_key(db: Session, key_id: int) -> bool:
        """Delete an API key"""
        api_key = db.query(APIKey).filter_by(id=key_id).first()
        if not api_key:
            return False

        db.delete(api_key)
        db.commit()

        logger.info(f"Deleted API key {key_id}")
        return True
