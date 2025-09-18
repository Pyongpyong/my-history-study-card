from __future__ import annotations

import hashlib
import hmac
import secrets


def _hash_password_with_salt(password: str, salt: str) -> str:
    data = f"{salt}:{password}".encode("utf-8")
    return hashlib.sha256(data).hexdigest()


def generate_password_hash(password: str) -> str:
    salt = secrets.token_hex(16)
    digest = _hash_password_with_salt(password, salt)
    return f"{salt}${digest}"


def verify_password(password: str, stored_hash: str) -> bool:
    try:
        salt, digest = stored_hash.split("$", 1)
    except ValueError:
        return False
    candidate = _hash_password_with_salt(password, salt)
    return hmac.compare_digest(candidate, digest)


def generate_api_key() -> str:
    return secrets.token_urlsafe(32)
