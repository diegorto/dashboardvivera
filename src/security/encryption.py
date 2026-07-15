"""Encryption utilities for sensitive data at rest"""
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
import base64
import os
from typing import Optional

from src.core.logger import setup_logger

logger = setup_logger(__name__)


class EncryptionManager:
    """Manages encryption/decryption of sensitive fields"""

    def __init__(self, master_key: Optional[str] = None):
        """
        Initialize encryption manager

        Args:
            master_key: Base encryption key (from environment or generate)
        """
        if master_key is None:
            master_key = os.getenv("ENCRYPTION_MASTER_KEY")

        if not master_key:
            logger.warning("ENCRYPTION_MASTER_KEY not set - generating temporary key")
            master_key = Fernet.generate_key().decode()

        # Derive a key from master key using PBKDF2
        self.master_key = master_key
        self.cipher = self._get_cipher(master_key)

    def _get_cipher(self, key: str) -> Fernet:
        """Derive Fernet cipher from string key"""
        # If key is already base64-encoded, use it directly
        if len(key) == 44 and key.endswith('='):
            try:
                Fernet(key.encode())
                return Fernet(key.encode())
            except Exception:
                pass

        # Otherwise, derive from master key using PBKDF2
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=b'executive_os_salt',  # Fixed salt for consistency
            iterations=100000,
        )
        derived_key = base64.urlsafe_b64encode(
            kdf.derive(key.encode())
        )
        return Fernet(derived_key)

    def encrypt(self, plaintext: str) -> str:
        """
        Encrypt sensitive plaintext

        Args:
            plaintext: Data to encrypt

        Returns:
            Base64-encoded encrypted data
        """
        if not plaintext:
            return ""

        try:
            encrypted = self.cipher.encrypt(plaintext.encode())
            return encrypted.decode()
        except Exception as e:
            logger.error(f"Encryption failed: {str(e)}")
            raise ValueError("Encryption operation failed")

    def decrypt(self, encrypted_text: str) -> str:
        """
        Decrypt sensitive data

        Args:
            encrypted_text: Base64-encoded encrypted data

        Returns:
            Decrypted plaintext
        """
        if not encrypted_text:
            return ""

        try:
            decrypted = self.cipher.decrypt(encrypted_text.encode())
            return decrypted.decode()
        except Exception as e:
            logger.error(f"Decryption failed: {str(e)}")
            raise ValueError("Decryption operation failed")


# Global instance
_encryption_manager: Optional[EncryptionManager] = None


def get_encryption_manager() -> EncryptionManager:
    """Get or create global encryption manager"""
    global _encryption_manager
    if _encryption_manager is None:
        _encryption_manager = EncryptionManager()
    return _encryption_manager


class EncryptedField:
    """SQLAlchemy hybrid property for encrypted database fields"""

    def __init__(self, name: str):
        self.name = name
        self.encryption_manager = get_encryption_manager()

    def encrypt_value(self, value: str) -> str:
        """Encrypt value for storage"""
        return self.encryption_manager.encrypt(value)

    def decrypt_value(self, value: str) -> str:
        """Decrypt value from storage"""
        return self.encryption_manager.decrypt(value)
