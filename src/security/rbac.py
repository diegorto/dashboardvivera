"""Role-Based Access Control (RBAC) for API endpoints"""
from enum import Enum
from typing import List, Callable
from functools import wraps
from fastapi import HTTPException, Depends, Request

from src.core.logger import setup_logger

logger = setup_logger(__name__)


class UserRole(str, Enum):
    """User roles in the system"""
    ADMIN = "admin"              # Full access to all operations
    REVIEWER = "reviewer"        # Can approve/reject items
    OPERATOR = "operator"        # Read-only access
    ANALYST = "analyst"          # Access to reports and statistics
    API_SERVICE = "api_service"  # Service-to-service API calls


class Permission(str, Enum):
    """Fine-grained permissions"""
    # Approval queue permissions
    APPROVE_CHANGES = "approve_changes"
    REJECT_CHANGES = "reject_changes"
    CORRECT_CHANGES = "correct_changes"
    VIEW_QUEUE = "view_queue"

    # Admin permissions
    MANAGE_USERS = "manage_users"
    MANAGE_API_KEYS = "manage_api_keys"
    VIEW_AUDIT_LOGS = "view_audit_logs"
    CONFIGURE_SYSTEM = "configure_system"

    # Operator permissions
    VIEW_REPORTS = "view_reports"
    EXPORT_DATA = "export_data"


# Role to permissions mapping
ROLE_PERMISSIONS = {
    UserRole.ADMIN: [
        Permission.APPROVE_CHANGES,
        Permission.REJECT_CHANGES,
        Permission.CORRECT_CHANGES,
        Permission.VIEW_QUEUE,
        Permission.MANAGE_USERS,
        Permission.MANAGE_API_KEYS,
        Permission.VIEW_AUDIT_LOGS,
        Permission.CONFIGURE_SYSTEM,
        Permission.VIEW_REPORTS,
        Permission.EXPORT_DATA,
    ],
    UserRole.REVIEWER: [
        Permission.APPROVE_CHANGES,
        Permission.REJECT_CHANGES,
        Permission.CORRECT_CHANGES,
        Permission.VIEW_QUEUE,
        Permission.VIEW_AUDIT_LOGS,
        Permission.VIEW_REPORTS,
    ],
    UserRole.OPERATOR: [
        Permission.VIEW_QUEUE,
        Permission.VIEW_REPORTS,
        Permission.EXPORT_DATA,
    ],
    UserRole.ANALYST: [
        Permission.VIEW_REPORTS,
        Permission.VIEW_AUDIT_LOGS,
    ],
    UserRole.API_SERVICE: [
        Permission.VIEW_QUEUE,
        Permission.APPROVE_CHANGES,
        Permission.VIEW_REPORTS,
    ],
}


class User:
    """Represents an authenticated user"""

    def __init__(self, user_id: str, email: str, role: UserRole, api_key: str = None):
        self.user_id = user_id
        self.email = email
        self.role = role
        self.api_key = api_key
        self.permissions = ROLE_PERMISSIONS.get(role, [])

    def has_permission(self, permission: Permission) -> bool:
        """Check if user has specific permission"""
        return permission in self.permissions

    def has_role(self, *roles: UserRole) -> bool:
        """Check if user has any of the specified roles"""
        return self.role in roles

    def __repr__(self) -> str:
        return f"User(id={self.user_id}, email={self.email}, role={self.role.value})"


class AuthenticationError(HTTPException):
    """Raised when authentication fails"""
    def __init__(self, detail: str = "Authentication failed"):
        super().__init__(status_code=401, detail=detail)


class AuthorizationError(HTTPException):
    """Raised when user lacks required permissions"""
    def __init__(self, detail: str = "Insufficient permissions"):
        super().__init__(status_code=403, detail=detail)


async def verify_api_key(request: Request) -> User:
    """
    Verify API key from request header

    Args:
        request: FastAPI request object

    Returns:
        Authenticated User object

    Raises:
        AuthenticationError: If API key is missing or invalid
    """
    api_key = request.headers.get("X-API-Key")

    if not api_key:
        logger.warning("Missing API key in request")
        raise AuthenticationError("API key required")

    # TODO: Lookup API key in database
    # For now, validate format and use mock validation
    if not api_key.startswith("sk_"):
        logger.warning(f"Invalid API key format: {api_key[:10]}...")
        raise AuthenticationError("Invalid API key")

    # Mock user lookup - in production, query database
    user = User(
        user_id="user_123",
        email="api@executive-os.local",
        role=UserRole.API_SERVICE,
        api_key=api_key
    )

    logger.debug(f"Authenticated user: {user}")
    return user


def require_role(*roles: UserRole):
    """
    Decorator to require specific role(s)

    Args:
        roles: One or more required roles

    Example:
        @require_role(UserRole.ADMIN, UserRole.REVIEWER)
        async def approve_change(item_id: int, current_user: User = Depends(get_current_user)):
            ...
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Try to get current_user from kwargs (when used as dependency)
            current_user: User = kwargs.get("current_user")

            if not current_user:
                raise AuthenticationError("User not authenticated")

            if not current_user.has_role(*roles):
                logger.warning(
                    f"User {current_user.email} (role={current_user.role.value}) "
                    f"attempted unauthorized operation"
                )
                raise AuthorizationError(
                    f"This operation requires one of: {', '.join(r.value for r in roles)}"
                )

            return await func(*args, **kwargs)

        return wrapper
    return decorator


def require_permission(permission: Permission):
    """
    Decorator to require specific permission

    Args:
        permission: Required permission

    Example:
        @require_permission(Permission.APPROVE_CHANGES)
        async def approve_item(item_id: int, current_user: User = Depends(get_current_user)):
            ...
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def wrapper(*args, **kwargs):
            current_user: User = kwargs.get("current_user")

            if not current_user:
                raise AuthenticationError("User not authenticated")

            if not current_user.has_permission(permission):
                logger.warning(
                    f"User {current_user.email} lacks permission: {permission.value}"
                )
                raise AuthorizationError(
                    f"This operation requires permission: {permission.value}"
                )

            return await func(*args, **kwargs)

        return wrapper
    return decorator
