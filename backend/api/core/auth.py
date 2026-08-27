"""Password hashing for the email/password auth added in PRD v0.5 (§5.3).

Demo-appropriate scope, not production-hardened: real bcrypt hashing so no
password is ever stored or logged in the clear, but deliberately no
rate-limiting, no password-reset flow, and no session/token expiry beyond
what the client already does for the existing phone/PIN identity model this
replaces. See docs/PRD.md v0.5 for the full scope decision.
"""

import bcrypt

_BCRYPT_ROUNDS = 12


def hash_password(password: str) -> str:
    """Hash a plaintext password for storage.

    Args:
        password: The plaintext password to hash.

    Returns:
        A bcrypt hash string, safe to store in password_hash columns.
    """
    salt = bcrypt.gensalt(rounds=_BCRYPT_ROUNDS)
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    """Check a plaintext password against a stored bcrypt hash.

    Args:
        password: The plaintext password to check.
        password_hash: The stored bcrypt hash to check against.

    Returns:
        True if the password matches the hash, False otherwise (including on
        a malformed hash, rather than raising).
    """
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except ValueError:
        return False
