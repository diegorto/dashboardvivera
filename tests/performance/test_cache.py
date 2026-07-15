"""Tests for caching performance optimization"""
import pytest
from datetime import datetime, timedelta
import asyncio

from src.performance.cache import CacheManager, get_cache, cache_result


class TestCacheManager:
    """Tests for CacheManager"""

    def test_cache_initialization(self):
        """Test initializing cache manager"""
        cache = CacheManager(ttl_seconds=1800)
        assert cache.ttl_seconds == 1800
        assert len(cache.in_memory_cache) == 0

    def test_set_and_get(self):
        """Test setting and getting cache values"""
        cache = CacheManager()
        cache.set("test_key", "test_value")

        value = cache.get("test_key")
        assert value == "test_value"

    def test_cache_miss(self):
        """Test cache miss returns None"""
        cache = CacheManager()
        value = cache.get("nonexistent")
        assert value is None

    def test_cache_expiration(self):
        """Test cache expiration"""
        cache = CacheManager(ttl_seconds=1)
        cache.set("temp_key", "temp_value")

        # Value should exist immediately
        assert cache.get("temp_key") == "temp_value"

        # Simulate expiration by modifying timestamp
        import time
        old_time = datetime.utcnow() - timedelta(seconds=2)
        cache.cache_timestamps["temp_key"] = old_time

        # Value should be expired now
        assert cache.get("temp_key") is None
        assert "temp_key" not in cache.in_memory_cache

    def test_generate_key(self):
        """Test cache key generation"""
        cache = CacheManager()
        key1 = cache._generate_key("prefix", "arg1", "arg2", kwarg="value")
        key2 = cache._generate_key("prefix", "arg1", "arg2", kwarg="value")
        key3 = cache._generate_key("prefix", "arg1", "arg3", kwarg="value")

        assert key1 == key2  # Same inputs = same key
        assert key1 != key3  # Different inputs = different key

    def test_delete(self):
        """Test deleting cache entry"""
        cache = CacheManager()
        cache.set("delete_key", "value")
        assert cache.get("delete_key") == "value"

        cache.delete("delete_key")
        assert cache.get("delete_key") is None

    def test_clear(self):
        """Test clearing all cache"""
        cache = CacheManager()
        cache.set("key1", "value1")
        cache.set("key2", "value2")
        cache.set("key3", "value3")

        assert len(cache.in_memory_cache) == 3

        cache.clear()
        assert len(cache.in_memory_cache) == 0
        assert len(cache.cache_timestamps) == 0

    def test_get_stats(self):
        """Test getting cache statistics"""
        cache = CacheManager()
        cache.set("key1", "value1")
        cache.set("key2", "value2")

        stats = cache.get_stats()
        assert stats["total_entries"] == 2
        assert "timestamp" in stats

    def test_cache_different_types(self):
        """Test caching different data types"""
        cache = CacheManager()

        cache.set("string", "test_value")
        cache.set("number", 42)
        cache.set("list", [1, 2, 3])
        cache.set("dict", {"key": "value"})

        assert cache.get("string") == "test_value"
        assert cache.get("number") == 42
        assert cache.get("list") == [1, 2, 3]
        assert cache.get("dict") == {"key": "value"}


class TestGlobalCache:
    """Tests for global cache singleton"""

    def test_get_cache_singleton(self):
        """Test that get_cache returns same instance"""
        cache1 = get_cache()
        cache2 = get_cache()
        assert cache1 is cache2


class TestCacheDecorator:
    """Tests for cache_result decorator"""

    @pytest.mark.asyncio
    async def test_cache_async_function(self):
        """Test caching async function results"""
        call_count = 0

        @cache_result("test_async", ttl_seconds=1800)
        async def async_function(x, y):
            nonlocal call_count
            call_count += 1
            await asyncio.sleep(0.01)
            return x + y

        # First call should execute function
        result1 = await async_function(1, 2)
        assert result1 == 3
        assert call_count == 1

        # Second call should use cache
        result2 = await async_function(1, 2)
        assert result2 == 3
        assert call_count == 1  # Function not called again

        # Different arguments should not use cache
        result3 = await async_function(2, 3)
        assert result3 == 5
        assert call_count == 2

    def test_cache_sync_function(self):
        """Test caching sync function results"""
        call_count = 0

        @cache_result("test_sync", ttl_seconds=1800)
        def sync_function(x, y):
            nonlocal call_count
            call_count += 1
            return x * y

        # First call should execute function
        result1 = sync_function(3, 4)
        assert result1 == 12
        assert call_count == 1

        # Second call should use cache
        result2 = sync_function(3, 4)
        assert result2 == 12
        assert call_count == 1  # Function not called again

    def test_cache_with_kwargs(self):
        """Test caching with keyword arguments"""
        call_count = 0

        @cache_result("test_kwargs")
        def func_with_kwargs(a, b=10, c=20):
            nonlocal call_count
            call_count += 1
            return a + b + c

        # Same args and kwargs
        result1 = func_with_kwargs(1, b=2, c=3)
        result2 = func_with_kwargs(1, b=2, c=3)
        assert call_count == 1

        # Different kwargs
        result3 = func_with_kwargs(1, b=5, c=3)
        assert call_count == 2
