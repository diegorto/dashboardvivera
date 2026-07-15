"""Caching layer for performance optimization"""
import json
import hashlib
from datetime import datetime, timedelta
from typing import Optional, Any, Callable
import asyncio
from functools import wraps

from src.core.logger import setup_logger

logger = setup_logger(__name__)


class CacheManager:
    """Manages caching with in-memory fallback"""

    def __init__(self, ttl_seconds: int = 3600):
        """
        Initialize cache manager

        Args:
            ttl_seconds: Time to live for cached items (default 1 hour)
        """
        self.ttl_seconds = ttl_seconds
        self.in_memory_cache = {}
        self.cache_timestamps = {}

    def _generate_key(self, prefix: str, *args, **kwargs) -> str:
        """Generate cache key from arguments"""
        key_data = f"{prefix}:{str(args)}:{str(sorted(kwargs.items()))}"
        return hashlib.md5(key_data.encode()).hexdigest()

    def _is_expired(self, key: str) -> bool:
        """Check if cache entry is expired"""
        if key not in self.cache_timestamps:
            return True

        created_at = self.cache_timestamps[key]
        if datetime.utcnow() - created_at > timedelta(seconds=self.ttl_seconds):
            return True

        return False

    def get(self, key: str) -> Optional[Any]:
        """Get value from cache"""
        if self._is_expired(key):
            self._delete(key)
            return None

        value = self.in_memory_cache.get(key)
        if value:
            logger.debug(f"Cache hit: {key}")
            return value

        return None

    def set(self, key: str, value: Any) -> None:
        """Set value in cache"""
        self.in_memory_cache[key] = value
        self.cache_timestamps[key] = datetime.utcnow()
        logger.debug(f"Cache set: {key}")

    def _delete(self, key: str) -> None:
        """Delete cache entry"""
        self.in_memory_cache.pop(key, None)
        self.cache_timestamps.pop(key, None)

    def delete(self, key: str) -> None:
        """Delete cache entry (public)"""
        self._delete(key)
        logger.debug(f"Cache deleted: {key}")

    def clear(self) -> None:
        """Clear all cache entries"""
        self.in_memory_cache.clear()
        self.cache_timestamps.clear()
        logger.info("Cache cleared")

    def get_stats(self) -> dict:
        """Get cache statistics"""
        return {
            "total_entries": len(self.in_memory_cache),
            "timestamp": datetime.utcnow().isoformat()
        }


# Global cache instance
_cache_manager: Optional[CacheManager] = None


def get_cache() -> CacheManager:
    """Get or create global cache manager"""
    global _cache_manager
    if _cache_manager is None:
        _cache_manager = CacheManager()
    return _cache_manager


def cache_result(prefix: str, ttl_seconds: int = 3600):
    """
    Decorator to cache function results

    Args:
        prefix: Cache key prefix
        ttl_seconds: Time to live for cached result

    Example:
        @cache_result("patient_match", ttl_seconds=1800)
        def fuzzy_match_patient(clairis_id, phone):
            ...
    """
    def decorator(func: Callable):
        @wraps(func)
        async def async_wrapper(*args, **kwargs):
            cache = get_cache()
            cache.ttl_seconds = ttl_seconds
            key = cache._generate_key(prefix, *args, **kwargs)

            # Try cache hit
            cached_value = cache.get(key)
            if cached_value is not None:
                return cached_value

            # Cache miss - execute function
            result = await func(*args, **kwargs)
            cache.set(key, result)

            return result

        @wraps(func)
        def sync_wrapper(*args, **kwargs):
            cache = get_cache()
            cache.ttl_seconds = ttl_seconds
            key = cache._generate_key(prefix, *args, **kwargs)

            # Try cache hit
            cached_value = cache.get(key)
            if cached_value is not None:
                return cached_value

            # Cache miss - execute function
            result = func(*args, **kwargs)
            cache.set(key, result)

            return result

        # Return appropriate wrapper
        import inspect
        if inspect.iscoroutinefunction(func):
            return async_wrapper
        else:
            return sync_wrapper

    return decorator
