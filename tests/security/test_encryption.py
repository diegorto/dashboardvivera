"""Tests for encryption utilities"""
import pytest
from src.security.encryption import (
    EncryptionManager, get_encryption_manager, EncryptedField
)
from cryptography.fernet import Fernet


class TestEncryptionManager:
    """Tests for EncryptionManager"""

    def test_manager_initialization_with_key(self):
        """Test initializing manager with explicit key"""
        manager = EncryptionManager("test_key_12345678901234567890")
        assert manager.master_key is not None

    def test_manager_initialization_without_key(self, monkeypatch):
        """Test initializing manager without key"""
        monkeypatch.delenv("ENCRYPTION_MASTER_KEY", raising=False)
        manager = EncryptionManager()
        assert manager.master_key is not None
        assert manager.cipher is not None

    def test_encrypt_decrypt_roundtrip(self):
        """Test encrypting and decrypting data"""
        manager = EncryptionManager("test_key_12345678901234567890")
        plaintext = "sensitive data"

        encrypted = manager.encrypt(plaintext)
        assert encrypted != plaintext
        assert len(encrypted) > 0

        decrypted = manager.decrypt(encrypted)
        assert decrypted == plaintext

    def test_encrypt_empty_string(self):
        """Test encrypting empty string"""
        manager = EncryptionManager("test_key_12345678901234567890")
        encrypted = manager.encrypt("")
        assert encrypted == ""

    def test_decrypt_empty_string(self):
        """Test decrypting empty string"""
        manager = EncryptionManager("test_key_12345678901234567890")
        decrypted = manager.decrypt("")
        assert decrypted == ""

    def test_encrypt_special_characters(self):
        """Test encrypting text with special characters"""
        manager = EncryptionManager("test_key_12345678901234567890")
        plaintext = "São Paulo, Brasil! @#$%^&*()"

        encrypted = manager.encrypt(plaintext)
        decrypted = manager.decrypt(encrypted)
        assert decrypted == plaintext

    def test_encrypt_numbers(self):
        """Test encrypting numbers"""
        manager = EncryptionManager("test_key_12345678901234567890")
        plaintext = "5548999999999"

        encrypted = manager.encrypt(plaintext)
        decrypted = manager.decrypt(encrypted)
        assert decrypted == plaintext

    def test_decrypt_invalid_data(self):
        """Test decrypting invalid data raises error"""
        manager = EncryptionManager("test_key_12345678901234567890")
        with pytest.raises(ValueError, match="Decryption operation failed"):
            manager.decrypt("invalid_encrypted_data")

    def test_different_keys_produce_different_ciphers(self):
        """Test that different keys produce different results"""
        manager1 = EncryptionManager("key_one_12345678901234567890")
        manager2 = EncryptionManager("key_two_12345678901234567890")

        plaintext = "test data"
        encrypted1 = manager1.encrypt(plaintext)
        encrypted2 = manager2.encrypt(plaintext)

        assert encrypted1 != encrypted2

        # manager1 can decrypt its own data
        assert manager1.decrypt(encrypted1) == plaintext

        # manager2 can decrypt its own data
        assert manager2.decrypt(encrypted2) == plaintext

    def test_cipher_is_fernet(self):
        """Test that cipher is a Fernet instance"""
        manager = EncryptionManager("test_key_12345678901234567890")
        assert isinstance(manager.cipher, Fernet)

    def test_fernet_key_handling(self):
        """Test handling of raw Fernet keys"""
        # Generate a real Fernet key
        fernet_key = Fernet.generate_key().decode()

        manager = EncryptionManager(fernet_key)
        plaintext = "test data"

        encrypted = manager.encrypt(plaintext)
        decrypted = manager.decrypt(encrypted)
        assert decrypted == plaintext


class TestGlobalEncryptionManager:
    """Tests for global encryption manager singleton"""

    def test_get_encryption_manager_singleton(self):
        """Test that get_encryption_manager returns same instance"""
        manager1 = get_encryption_manager()
        manager2 = get_encryption_manager()
        assert manager1 is manager2

    def test_global_manager_can_encrypt_decrypt(self):
        """Test global manager can encrypt and decrypt"""
        manager = get_encryption_manager()
        plaintext = "test data"

        encrypted = manager.encrypt(plaintext)
        decrypted = manager.decrypt(encrypted)
        assert decrypted == plaintext


class TestEncryptedField:
    """Tests for EncryptedField class"""

    def test_encrypted_field_creation(self):
        """Test creating an EncryptedField"""
        field = EncryptedField("sensitive_field")
        assert field.name == "sensitive_field"
        assert field.encryption_manager is not None

    def test_encrypt_value(self):
        """Test EncryptedField.encrypt_value"""
        field = EncryptedField("test_field")
        plaintext = "secret data"

        encrypted = field.encrypt_value(plaintext)
        assert encrypted != plaintext

    def test_decrypt_value(self):
        """Test EncryptedField.decrypt_value"""
        field = EncryptedField("test_field")
        plaintext = "secret data"

        encrypted = field.encrypt_value(plaintext)
        decrypted = field.decrypt_value(encrypted)
        assert decrypted == plaintext

    def test_encrypted_field_roundtrip(self):
        """Test full encrypt/decrypt cycle"""
        field = EncryptedField("email_field")
        email = "user@example.com"

        encrypted = field.encrypt_value(email)
        assert field.decrypt_value(encrypted) == email

    def test_multiple_fields_use_same_key(self):
        """Test that multiple fields use same encryption key"""
        field1 = EncryptedField("field1")
        field2 = EncryptedField("field2")

        data1 = "data1"
        data2 = "data2"

        encrypted1 = field1.encrypt_value(data1)
        encrypted2 = field2.encrypt_value(data2)

        # Both should decrypt with their respective fields
        assert field1.decrypt_value(encrypted1) == data1
        assert field2.decrypt_value(encrypted2) == data2

        # Cross-field decryption works because they share same global manager
        assert field1.decrypt_value(encrypted2) == data2
        assert field2.decrypt_value(encrypted1) == data1
