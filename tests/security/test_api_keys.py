"""Tests for API key management"""
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from datetime import datetime, timedelta

from src.models import Base, User, APIKey
from src.security.api_keys import APIKeyManager
from src.security.rbac import UserRole


@pytest.fixture
def test_db():
    """Create in-memory test database"""
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    SessionLocal = sessionmaker(bind=engine)
    session = SessionLocal()
    yield session
    session.close()


@pytest.fixture
def test_user(test_db):
    """Create test user"""
    user = User(
        user_id="test_user_123",
        email="testuser@example.com",
        role=UserRole.REVIEWER.value,
        active=True
    )
    test_db.add(user)
    test_db.commit()
    return user


class TestAPIKeyGeneration:
    """Tests for API key generation"""

    def test_generate_key_format(self):
        """Test that generated keys have sk_ prefix"""
        key = APIKeyManager.generate_key()
        assert key.startswith("sk_")
        assert len(key) > 3

    def test_generate_unique_keys(self):
        """Test that generated keys are unique"""
        key1 = APIKeyManager.generate_key()
        key2 = APIKeyManager.generate_key()
        assert key1 != key2

    def test_hash_key(self):
        """Test key hashing"""
        key = APIKeyManager.generate_key()
        key_hash = APIKeyManager.hash_key(key)
        assert key_hash != key
        assert len(key_hash) == 64  # SHA256 hex digest

    def test_hash_consistency(self):
        """Test that same key always hashes to same value"""
        key = "sk_test123456"
        hash1 = APIKeyManager.hash_key(key)
        hash2 = APIKeyManager.hash_key(key)
        assert hash1 == hash2


class TestAPIKeyCreation:
    """Tests for API key creation"""

    def test_create_api_key(self, test_db, test_user):
        """Test creating an API key"""
        raw_key, api_key = APIKeyManager.create_api_key(
            test_db,
            test_user.user_id,
            name="Test Key"
        )

        assert raw_key.startswith("sk_")
        assert api_key.name == "Test Key"
        assert api_key.user_id == test_user.user_id
        assert api_key.active is True
        assert api_key.requests_per_minute == 60

    def test_create_api_key_custom_rate_limit(self, test_db, test_user):
        """Test creating API key with custom rate limit"""
        raw_key, api_key = APIKeyManager.create_api_key(
            test_db,
            test_user.user_id,
            name="Limited Key",
            requests_per_minute=10
        )

        assert api_key.requests_per_minute == 10

    def test_create_api_key_nonexistent_user(self, test_db):
        """Test creating key for nonexistent user"""
        with pytest.raises(ValueError, match="User .* not found"):
            APIKeyManager.create_api_key(test_db, "nonexistent_user")

    def test_api_key_stored_as_hash(self, test_db, test_user):
        """Test that API key is stored as hash, not plaintext"""
        raw_key, api_key = APIKeyManager.create_api_key(
            test_db,
            test_user.user_id
        )

        assert api_key.key_hash != raw_key
        assert len(api_key.key_hash) == 64

    def test_create_multiple_keys_for_user(self, test_db, test_user):
        """Test creating multiple keys for same user"""
        raw_key1, api_key1 = APIKeyManager.create_api_key(
            test_db,
            test_user.user_id,
            name="Key 1"
        )
        raw_key2, api_key2 = APIKeyManager.create_api_key(
            test_db,
            test_user.user_id,
            name="Key 2"
        )

        assert api_key1.id != api_key2.id
        assert raw_key1 != raw_key2

        # Both should be retrievable
        keys = APIKeyManager.list_user_keys(test_db, test_user.user_id)
        assert len(keys) == 2


class TestAPIKeyValidation:
    """Tests for API key validation"""

    def test_validate_valid_key(self, test_db, test_user):
        """Test validating a valid API key"""
        raw_key, api_key = APIKeyManager.create_api_key(
            test_db,
            test_user.user_id
        )

        result = APIKeyManager.validate_api_key(test_db, raw_key)
        assert result is not None
        retrieved_key, retrieved_user = result
        assert retrieved_key.id == api_key.id
        assert retrieved_user.user_id == test_user.user_id

    def test_validate_invalid_key(self, test_db):
        """Test validating an invalid key"""
        result = APIKeyManager.validate_api_key(test_db, "sk_invalid_key")
        assert result is None

    def test_validate_revoked_key(self, test_db, test_user):
        """Test validating a revoked key"""
        raw_key, api_key = APIKeyManager.create_api_key(
            test_db,
            test_user.user_id
        )

        # Revoke the key
        APIKeyManager.revoke_api_key(test_db, api_key.id)

        result = APIKeyManager.validate_api_key(test_db, raw_key)
        assert result is None

    def test_validate_updates_last_used(self, test_db, test_user):
        """Test that validation updates last_used_at"""
        raw_key, api_key = APIKeyManager.create_api_key(
            test_db,
            test_user.user_id
        )

        # Initial last_used_at should be None
        assert api_key.last_used_at is None

        # Validate key
        APIKeyManager.validate_api_key(test_db, raw_key)

        # Refresh from database
        test_db.refresh(api_key)
        assert api_key.last_used_at is not None
        assert api_key.last_used_at <= datetime.utcnow()

    def test_validate_inactive_key(self, test_db, test_user):
        """Test validating an inactive key"""
        raw_key, api_key = APIKeyManager.create_api_key(
            test_db,
            test_user.user_id
        )

        # Mark as inactive
        api_key.active = False
        test_db.commit()

        result = APIKeyManager.validate_api_key(test_db, raw_key)
        assert result is None

    def test_validate_with_inactive_user(self, test_db, test_user):
        """Test validating key for inactive user"""
        raw_key, api_key = APIKeyManager.create_api_key(
            test_db,
            test_user.user_id
        )

        # Deactivate user
        test_user.active = False
        test_db.commit()

        result = APIKeyManager.validate_api_key(test_db, raw_key)
        assert result is None


class TestAPIKeyRevocation:
    """Tests for API key revocation"""

    def test_revoke_api_key(self, test_db, test_user):
        """Test revoking an API key"""
        raw_key, api_key = APIKeyManager.create_api_key(
            test_db,
            test_user.user_id
        )

        success = APIKeyManager.revoke_api_key(test_db, api_key.id)
        assert success is True

        # Refresh from database
        test_db.refresh(api_key)
        assert api_key.revoked_at is not None
        assert api_key.active is False

    def test_revoke_nonexistent_key(self, test_db):
        """Test revoking nonexistent key"""
        success = APIKeyManager.revoke_api_key(test_db, 999)
        assert success is False

    def test_revoked_key_cannot_authenticate(self, test_db, test_user):
        """Test that revoked key cannot authenticate"""
        raw_key, api_key = APIKeyManager.create_api_key(
            test_db,
            test_user.user_id
        )

        # Revoke and attempt to validate
        APIKeyManager.revoke_api_key(test_db, api_key.id)
        result = APIKeyManager.validate_api_key(test_db, raw_key)
        assert result is None


class TestAPIKeyDeletion:
    """Tests for API key deletion"""

    def test_delete_api_key(self, test_db, test_user):
        """Test deleting an API key"""
        raw_key, api_key = APIKeyManager.create_api_key(
            test_db,
            test_user.user_id
        )

        key_id = api_key.id
        success = APIKeyManager.delete_api_key(test_db, key_id)
        assert success is True

        # Verify key is deleted
        deleted_key = test_db.query(APIKey).filter_by(id=key_id).first()
        assert deleted_key is None

    def test_delete_nonexistent_key(self, test_db):
        """Test deleting nonexistent key"""
        success = APIKeyManager.delete_api_key(test_db, 999)
        assert success is False


class TestListUserKeys:
    """Tests for listing user API keys"""

    def test_list_user_keys_empty(self, test_db, test_user):
        """Test listing keys when user has none"""
        keys = APIKeyManager.list_user_keys(test_db, test_user.user_id)
        assert len(keys) == 0

    def test_list_user_keys(self, test_db, test_user):
        """Test listing user keys"""
        APIKeyManager.create_api_key(test_db, test_user.user_id, name="Key 1")
        APIKeyManager.create_api_key(test_db, test_user.user_id, name="Key 2")
        APIKeyManager.create_api_key(test_db, test_user.user_id, name="Key 3")

        keys = APIKeyManager.list_user_keys(test_db, test_user.user_id)
        assert len(keys) == 3
        assert all(k.user_id == test_user.user_id for k in keys)

    def test_list_keys_different_users(self, test_db):
        """Test that listing keys only returns for specific user"""
        user1 = User(
            user_id="user1",
            email="user1@example.com",
            role=UserRole.ADMIN.value
        )
        user2 = User(
            user_id="user2",
            email="user2@example.com",
            role=UserRole.REVIEWER.value
        )
        test_db.add_all([user1, user2])
        test_db.commit()

        APIKeyManager.create_api_key(test_db, user1.user_id, name="User1 Key")
        APIKeyManager.create_api_key(test_db, user2.user_id, name="User2 Key")
        APIKeyManager.create_api_key(test_db, user2.user_id, name="User2 Key 2")

        user1_keys = APIKeyManager.list_user_keys(test_db, user1.user_id)
        user2_keys = APIKeyManager.list_user_keys(test_db, user2.user_id)

        assert len(user1_keys) == 1
        assert len(user2_keys) == 2
