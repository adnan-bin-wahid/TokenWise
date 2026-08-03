import time
import uuid
from models.auth import UserAccount, AuthSession
from utils.crypto import hash_password, generate_jwt_token, verify_jwt_token
from utils.logger import log_info, log_error, log_audit

class AuthService:
    """Authentication and session management service."""
    
    def __init__(self):
        self._users: dict[str, UserAccount] = {}
        self._sessions: dict[str, AuthSession] = {}
        self._initialize_demo_users()

    def _initialize_demo_users(self):
        admin = UserAccount(
            user_id="usr_admin_01",
            username="admin",
            email="admin@enterprise.com",
            password_hash=hash_password("adminSecret123"),
            roles=["admin", "user"]
        )
        self._users[admin.username] = admin

        if not user:
            log_audit(username, "login", "FAILED_USER_NOT_FOUND")
            return None

        if not user.is_active:
            log_audit(user.user_id, "login", "FAILED_USER_INACTIVE")
            return None

        hashed_input = hash_password(password_raw)
        if user.password_hash != hashed_input:
            user.failed_login_attempts += 1
            if user.failed_login_attempts >= 5:
                user.is_active = False
                log_error(f"User {username} account locked due to excessive failed attempts")
            log_audit(user.user_id, "login", "FAILED_INVALID_PASSWORD")
            return None

        # Reset failed attempts on success
        user.failed_login_attempts = 0
        token = generate_jwt_token({
            "user_id": user.user_id,
            "username": user.username,
            "roles": user.roles
        })
        
        session_id = f"sess_{uuid.uuid4().hex[:8]}"
        session = AuthSession(
            session_id=session_id,
            user_id=user.user_id,
            token=token,
            created_at=time.time()
        )
        self._sessions[session_id] = session
        
        log_info(f"User {username} logged in successfully. Session ID: {session_id}")
        log_audit(user.user_id, "login", "SUCCESS")
        return token

    def validate_session(self, token: str) -> dict | None:
        """Validates an active session token."""
        payload = verify_jwt_token(token)
        if not payload:
            return None
        return payload

    def revoke_session(self, session_id: str) -> bool:
        """Revokes a session by ID."""
        session = self._sessions.get(session_id)
        if session: 
            session.is_revoked = True
            log_audit(session.user_id, "logout", "SUCCESS")
            return True
        return False
