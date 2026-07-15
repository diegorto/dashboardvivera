"""Tests for Role-Based Access Control"""
import pytest
from src.security.rbac import (
    UserRole, Permission, User, ROLE_PERMISSIONS,
    AuthenticationError, AuthorizationError
)


class TestUserRoles:
    """Tests for UserRole enum"""

    def test_all_roles_defined(self):
        """Verify all expected roles are defined"""
        assert UserRole.ADMIN in [UserRole.ADMIN, UserRole.REVIEWER, UserRole.OPERATOR, UserRole.ANALYST, UserRole.API_SERVICE]
        assert UserRole.REVIEWER in [UserRole.ADMIN, UserRole.REVIEWER, UserRole.OPERATOR, UserRole.ANALYST, UserRole.API_SERVICE]
        assert UserRole.OPERATOR in [UserRole.ADMIN, UserRole.REVIEWER, UserRole.OPERATOR, UserRole.ANALYST, UserRole.API_SERVICE]
        assert UserRole.ANALYST in [UserRole.ADMIN, UserRole.REVIEWER, UserRole.OPERATOR, UserRole.ANALYST, UserRole.API_SERVICE]
        assert UserRole.API_SERVICE in [UserRole.ADMIN, UserRole.REVIEWER, UserRole.OPERATOR, UserRole.ANALYST, UserRole.API_SERVICE]

    def test_role_values(self):
        """Verify role string values"""
        assert UserRole.ADMIN.value == "admin"
        assert UserRole.REVIEWER.value == "reviewer"
        assert UserRole.OPERATOR.value == "operator"
        assert UserRole.ANALYST.value == "analyst"
        assert UserRole.API_SERVICE.value == "api_service"


class TestPermissions:
    """Tests for Permission enum"""

    def test_approval_permissions(self):
        """Test approval-related permissions"""
        assert Permission.APPROVE_CHANGES in [p for p in Permission]
        assert Permission.REJECT_CHANGES in [p for p in Permission]
        assert Permission.CORRECT_CHANGES in [p for p in Permission]
        assert Permission.VIEW_QUEUE in [p for p in Permission]

    def test_admin_permissions(self):
        """Test admin-related permissions"""
        assert Permission.MANAGE_USERS in [p for p in Permission]
        assert Permission.MANAGE_API_KEYS in [p for p in Permission]
        assert Permission.VIEW_AUDIT_LOGS in [p for p in Permission]
        assert Permission.CONFIGURE_SYSTEM in [p for p in Permission]

    def test_operator_permissions(self):
        """Test operator-related permissions"""
        assert Permission.VIEW_REPORTS in [p for p in Permission]
        assert Permission.EXPORT_DATA in [p for p in Permission]


class TestRolePermissionMapping:
    """Tests for ROLE_PERMISSIONS mapping"""

    def test_admin_has_all_permissions(self):
        """Admin role should have all permissions"""
        admin_perms = ROLE_PERMISSIONS[UserRole.ADMIN]
        assert Permission.APPROVE_CHANGES in admin_perms
        assert Permission.REJECT_CHANGES in admin_perms
        assert Permission.MANAGE_USERS in admin_perms
        assert Permission.MANAGE_API_KEYS in admin_perms
        assert Permission.VIEW_AUDIT_LOGS in admin_perms
        assert Permission.CONFIGURE_SYSTEM in admin_perms
        assert len(admin_perms) == 10

    def test_reviewer_permissions(self):
        """Reviewer should have approval and audit permissions"""
        reviewer_perms = ROLE_PERMISSIONS[UserRole.REVIEWER]
        assert Permission.APPROVE_CHANGES in reviewer_perms
        assert Permission.REJECT_CHANGES in reviewer_perms
        assert Permission.CORRECT_CHANGES in reviewer_perms
        assert Permission.VIEW_QUEUE in reviewer_perms
        assert Permission.VIEW_AUDIT_LOGS in reviewer_perms
        assert Permission.MANAGE_USERS not in reviewer_perms

    def test_operator_permissions(self):
        """Operator should have limited permissions"""
        operator_perms = ROLE_PERMISSIONS[UserRole.OPERATOR]
        assert Permission.VIEW_QUEUE in operator_perms
        assert Permission.VIEW_REPORTS in operator_perms
        assert Permission.EXPORT_DATA in operator_perms
        assert Permission.APPROVE_CHANGES not in operator_perms

    def test_analyst_permissions(self):
        """Analyst should have report and audit permissions"""
        analyst_perms = ROLE_PERMISSIONS[UserRole.ANALYST]
        assert Permission.VIEW_REPORTS in analyst_perms
        assert Permission.VIEW_AUDIT_LOGS in analyst_perms
        assert Permission.APPROVE_CHANGES not in analyst_perms

    def test_api_service_permissions(self):
        """API_SERVICE should have limited permissions"""
        api_perms = ROLE_PERMISSIONS[UserRole.API_SERVICE]
        assert Permission.VIEW_QUEUE in api_perms
        assert Permission.APPROVE_CHANGES in api_perms
        assert Permission.VIEW_REPORTS in api_perms
        assert Permission.MANAGE_USERS not in api_perms


class TestUser:
    """Tests for User class"""

    def test_user_creation(self):
        """Test creating a user"""
        user = User(
            user_id="user_123",
            email="test@example.com",
            role=UserRole.ADMIN
        )
        assert user.user_id == "user_123"
        assert user.email == "test@example.com"
        assert user.role == UserRole.ADMIN

    def test_user_with_api_key(self):
        """Test creating user with API key"""
        user = User(
            user_id="api_user",
            email="api@example.com",
            role=UserRole.API_SERVICE,
            api_key="sk_test123"
        )
        assert user.api_key == "sk_test123"

    def test_admin_has_permissions(self):
        """Admin user should have all permissions"""
        user = User(
            user_id="admin_user",
            email="admin@example.com",
            role=UserRole.ADMIN
        )
        assert user.has_permission(Permission.APPROVE_CHANGES)
        assert user.has_permission(Permission.MANAGE_USERS)
        assert user.has_permission(Permission.CONFIGURE_SYSTEM)

    def test_operator_lacks_admin_permissions(self):
        """Operator should not have admin permissions"""
        user = User(
            user_id="op_user",
            email="operator@example.com",
            role=UserRole.OPERATOR
        )
        assert not user.has_permission(Permission.MANAGE_USERS)
        assert not user.has_permission(Permission.APPROVE_CHANGES)
        assert user.has_permission(Permission.VIEW_QUEUE)

    def test_has_role_single(self):
        """Test checking for single role"""
        user = User(
            user_id="user",
            email="user@example.com",
            role=UserRole.REVIEWER
        )
        assert user.has_role(UserRole.REVIEWER)
        assert not user.has_role(UserRole.ADMIN)

    def test_has_role_multiple(self):
        """Test checking if user has one of multiple roles"""
        user = User(
            user_id="user",
            email="user@example.com",
            role=UserRole.REVIEWER
        )
        assert user.has_role(UserRole.ADMIN, UserRole.REVIEWER)
        assert user.has_role(UserRole.REVIEWER, UserRole.OPERATOR)
        assert not user.has_role(UserRole.ADMIN, UserRole.OPERATOR)

    def test_user_repr(self):
        """Test user string representation"""
        user = User(
            user_id="user_123",
            email="test@example.com",
            role=UserRole.ADMIN
        )
        repr_str = repr(user)
        assert "user_123" in repr_str
        assert "test@example.com" in repr_str
        assert "admin" in repr_str


class TestAuthenticationError:
    """Tests for AuthenticationError"""

    def test_default_message(self):
        """Test default error message"""
        error = AuthenticationError()
        assert error.status_code == 401
        assert error.detail == "Authentication failed"

    def test_custom_message(self):
        """Test custom error message"""
        error = AuthenticationError("Invalid credentials")
        assert error.status_code == 401
        assert error.detail == "Invalid credentials"


class TestAuthorizationError:
    """Tests for AuthorizationError"""

    def test_default_message(self):
        """Test default error message"""
        error = AuthorizationError()
        assert error.status_code == 403
        assert error.detail == "Insufficient permissions"

    def test_custom_message(self):
        """Test custom error message"""
        error = AuthorizationError("Admin access required")
        assert error.status_code == 403
        assert error.detail == "Admin access required"
