"""FastAPI security middleware for API key validation and rate limiting"""
from datetime import datetime, timedelta
from fastapi import Request, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse
from sqlalchemy.orm import Session

from src.core.logger import setup_logger
from src.security.api_keys import APIKeyManager
from src.security.rate_limiter import get_rate_limiter
from src.security.rbac import AuthenticationError, AuthorizationError

logger = setup_logger(__name__)


class APIKeyAuthMiddleware(BaseHTTPMiddleware):
    """Middleware to validate API key and attach user to request"""

    def __init__(self, app, db_session: Session):
        super().__init__(app)
        self.db = db_session

    async def dispatch(self, request: Request, call_next):
        # Skip middleware for health checks and root paths
        if request.url.path in ["/health", "/", "/docs", "/openapi.json", "/redoc"]:
            return await call_next(request)

        # Extract API key from header
        api_key = request.headers.get("X-API-Key")

        if not api_key:
            logger.warning("Missing API key in request")
            return JSONResponse(
                status_code=401,
                content={"detail": "API key required"}
            )

        # Validate API key
        result = APIKeyManager.validate_api_key(self.db, api_key)
        if not result:
            logger.warning(f"Invalid API key attempted")
            return JSONResponse(
                status_code=401,
                content={"detail": "Invalid or inactive API key"}
            )

        api_key_obj, user = result

        # Check rate limit
        rate_limiter = get_rate_limiter()
        allowed, message = await rate_limiter.check_rate_limit(
            api_key_obj.id,
            api_key_obj.requests_per_minute
        )

        if not allowed:
            logger.warning(f"Rate limit exceeded for user {user.user_id}")
            return JSONResponse(
                status_code=429,
                content={"detail": message}
            )

        # Attach user and API key to request state
        request.state.current_user = user
        request.state.api_key = api_key_obj

        response = await call_next(request)
        return response


class RateLimitHeaderMiddleware(BaseHTTPMiddleware):
    """Add rate limit headers to responses"""

    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)

        # Add rate limit headers if user is authenticated
        if hasattr(request.state, "api_key"):
            api_key = request.state.api_key
            rate_limiter = get_rate_limiter()
            stats = rate_limiter.get_stats(api_key.id)

            response.headers["X-RateLimit-Limit"] = str(api_key.requests_per_minute)
            response.headers["X-RateLimit-Remaining"] = str(
                api_key.requests_per_minute - stats["requests_this_minute"]
            )
            response.headers["X-RateLimit-Reset"] = str(
                int((datetime.utcnow() + timedelta(minutes=1)).timestamp())
            )

        return response
