"""Rate limiting for API keys"""
import time
from collections import defaultdict
from datetime import datetime, timedelta
from typing import Dict, Tuple
import asyncio

from src.core.logger import setup_logger

logger = setup_logger(__name__)


class APIKeyRateLimiter:
    """Rate limiter for API keys with per-key request tracking"""

    def __init__(self):
        """Initialize rate limiter with empty request history"""
        self.request_history: Dict[str, list] = defaultdict(list)
        self.lock = asyncio.Lock()

    async def check_rate_limit(
        self,
        api_key_id: int,
        requests_per_minute: int = 60
    ) -> Tuple[bool, str]:
        """
        Check if API key is within rate limit

        Args:
            api_key_id: ID of API key making request
            requests_per_minute: Allowed requests per minute

        Returns:
            Tuple of (allowed: bool, message: str)
        """
        async with self.lock:
            now = datetime.utcnow()
            minute_ago = now - timedelta(minutes=1)

            # Clean up old requests
            key_str = str(api_key_id)
            self.request_history[key_str] = [
                ts for ts in self.request_history[key_str]
                if ts > minute_ago
            ]

            # Check if at limit
            request_count = len(self.request_history[key_str])
            if request_count >= requests_per_minute:
                logger.warning(
                    f"Rate limit exceeded for API key {api_key_id}: "
                    f"{request_count}/{requests_per_minute} requests"
                )
                return False, f"Rate limit exceeded: {request_count}/{requests_per_minute} requests per minute"

            # Record this request
            self.request_history[key_str].append(now)
            remaining = requests_per_minute - request_count - 1

            return True, f"OK ({remaining} requests remaining)"

    async def reset_key(self, api_key_id: int):
        """Reset rate limit counter for a key (e.g., on key revocation)"""
        async with self.lock:
            key_str = str(api_key_id)
            if key_str in self.request_history:
                del self.request_history[key_str]
                logger.debug(f"Reset rate limiter for API key {api_key_id}")

    def get_stats(self, api_key_id: int) -> dict:
        """Get rate limit stats for a key"""
        key_str = str(api_key_id)
        now = datetime.utcnow()
        minute_ago = now - timedelta(minutes=1)

        recent_requests = [
            ts for ts in self.request_history[key_str]
            if ts > minute_ago
        ]

        return {
            "api_key_id": api_key_id,
            "requests_this_minute": len(recent_requests),
            "timestamp": now.isoformat()
        }


# Global instance
_rate_limiter: APIKeyRateLimiter = None


def get_rate_limiter() -> APIKeyRateLimiter:
    """Get or create global rate limiter"""
    global _rate_limiter
    if _rate_limiter is None:
        _rate_limiter = APIKeyRateLimiter()
    return _rate_limiter
