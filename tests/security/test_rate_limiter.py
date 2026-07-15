"""Tests for API key rate limiting"""
import pytest
import asyncio
from datetime import datetime, timedelta

from src.security.rate_limiter import APIKeyRateLimiter, get_rate_limiter


@pytest.mark.asyncio
class TestAPIKeyRateLimiter:
    """Tests for APIKeyRateLimiter"""

    async def test_rate_limiter_initialization(self):
        """Test initializing rate limiter"""
        limiter = APIKeyRateLimiter()
        assert limiter.request_history == {}

    async def test_allow_request_within_limit(self):
        """Test that requests within limit are allowed"""
        limiter = APIKeyRateLimiter()

        allowed, msg = await limiter.check_rate_limit(api_key_id=1, requests_per_minute=60)
        assert allowed is True
        assert "OK" in msg or "remaining" in msg

    async def test_block_request_at_limit(self):
        """Test that requests at limit are blocked"""
        limiter = APIKeyRateLimiter()

        # Fill up to limit
        for i in range(5):
            allowed, msg = await limiter.check_rate_limit(api_key_id=1, requests_per_minute=5)
            assert allowed is True

        # Next request should be blocked
        allowed, msg = await limiter.check_rate_limit(api_key_id=1, requests_per_minute=5)
        assert allowed is False
        assert "Rate limit exceeded" in msg

    async def test_different_keys_separate_limits(self):
        """Test that different keys have separate rate limits"""
        limiter = APIKeyRateLimiter()

        # Use up limit for key 1
        for i in range(3):
            await limiter.check_rate_limit(api_key_id=1, requests_per_minute=3)

        # Key 2 should still be allowed
        allowed, msg = await limiter.check_rate_limit(api_key_id=2, requests_per_minute=3)
        assert allowed is True

    async def test_rate_limit_custom_requests_per_minute(self):
        """Test rate limiting with different requests_per_minute values"""
        limiter = APIKeyRateLimiter()

        # Key 1: 2 requests per minute
        for i in range(2):
            allowed, msg = await limiter.check_rate_limit(api_key_id=1, requests_per_minute=2)
            assert allowed is True

        allowed, msg = await limiter.check_rate_limit(api_key_id=1, requests_per_minute=2)
        assert allowed is False

        # Key 2: 5 requests per minute (should allow more)
        for i in range(5):
            allowed, msg = await limiter.check_rate_limit(api_key_id=2, requests_per_minute=5)
            assert allowed is True

        allowed, msg = await limiter.check_rate_limit(api_key_id=2, requests_per_minute=5)
        assert allowed is False

    async def test_get_rate_limiter_stats(self):
        """Test getting rate limiter statistics"""
        limiter = APIKeyRateLimiter()

        # Make some requests
        await limiter.check_rate_limit(api_key_id=1, requests_per_minute=10)
        await limiter.check_rate_limit(api_key_id=1, requests_per_minute=10)
        await limiter.check_rate_limit(api_key_id=1, requests_per_minute=10)

        stats = limiter.get_stats(api_key_id=1)
        assert stats["api_key_id"] == 1
        assert stats["requests_this_minute"] == 3

    async def test_reset_key(self):
        """Test resetting rate limit counter for a key"""
        limiter = APIKeyRateLimiter()

        # Make requests
        for i in range(3):
            await limiter.check_rate_limit(api_key_id=1, requests_per_minute=5)

        # Verify requests recorded
        stats = limiter.get_stats(api_key_id=1)
        assert stats["requests_this_minute"] == 3

        # Reset
        await limiter.reset_key(api_key_id=1)

        # Stats should show no requests
        stats = limiter.get_stats(api_key_id=1)
        assert stats["requests_this_minute"] == 0

    async def test_old_requests_cleanup(self):
        """Test that requests older than 1 minute are cleaned up"""
        limiter = APIKeyRateLimiter()

        # Manually add an old request (simulating time passage)
        import time
        old_time = datetime.utcnow() - timedelta(minutes=2)
        limiter.request_history["1"] = [old_time]

        # Make a new request (should clean up old one)
        allowed, msg = await limiter.check_rate_limit(api_key_id=1, requests_per_minute=1)
        assert allowed is True

        # Old request should be gone
        stats = limiter.get_stats(api_key_id=1)
        assert stats["requests_this_minute"] == 1

    async def test_multiple_keys_concurrent_requests(self):
        """Test handling multiple keys with concurrent requests"""
        limiter = APIKeyRateLimiter()

        # Create concurrent requests from different keys
        tasks = []
        for key_id in range(1, 5):
            for i in range(3):
                tasks.append(limiter.check_rate_limit(api_key_id=key_id, requests_per_minute=10))

        results = await asyncio.gather(*tasks)
        # All should be allowed (each key only has 3 requests)
        assert all(allowed for allowed, msg in results)


@pytest.mark.asyncio
class TestGlobalRateLimiter:
    """Tests for global rate limiter singleton"""

    async def test_get_rate_limiter_singleton(self):
        """Test that get_rate_limiter returns same instance"""
        limiter1 = get_rate_limiter()
        limiter2 = get_rate_limiter()
        assert limiter1 is limiter2

    async def test_global_limiter_works(self):
        """Test global limiter functions"""
        limiter = get_rate_limiter()

        allowed, msg = await limiter.check_rate_limit(api_key_id=999, requests_per_minute=5)
        assert allowed is True

        stats = limiter.get_stats(api_key_id=999)
        assert stats["requests_this_minute"] >= 1


class TestRateLimitMessages:
    """Tests for rate limit error messages"""

    @pytest.mark.asyncio
    async def test_ok_message_format(self):
        """Test format of OK message"""
        limiter = APIKeyRateLimiter()

        allowed, msg = await limiter.check_rate_limit(api_key_id=1, requests_per_minute=5)
        assert allowed is True
        assert "OK" in msg or "remaining" in msg

    @pytest.mark.asyncio
    async def test_exceeded_message_format(self):
        """Test format of exceeded message"""
        limiter = APIKeyRateLimiter()

        # Fill limit
        for i in range(3):
            await limiter.check_rate_limit(api_key_id=1, requests_per_minute=3)

        allowed, msg = await limiter.check_rate_limit(api_key_id=1, requests_per_minute=3)
        assert allowed is False
        assert "Rate limit exceeded" in msg
        assert "3/3" in msg
