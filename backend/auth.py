"""Accounts: handle + password, with a session cookie. Passwords are hashed with scrypt
(the same format the old Node server used, so existing accounts keep working)."""
import base64
import hashlib
import hmac
import os
import re
import secrets

from fastapi import Request

from . import emailer
from .db import many, now, one, run
from .http_util import HttpError, is_https

COOKIE = "popcorn_sid"
SESSION_MS = 30 * 24 * 60 * 60 * 1000
HOUR = 3600 * 1000
EMAIL = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]{2,}$")
HANDLE = re.compile(r"^[A-Za-z0-9_]{3,20}$")


def _sha(s):
    return hashlib.sha256(s.encode()).hexdigest()


def _scrypt(password, salt):
    return hashlib.scrypt(password.encode(), salt=salt, n=16384, r=8, p=1, dklen=64, maxmem=64 * 1024 * 1024)


def hash_password(password):
    salt = os.urandom(16)
    return f"scrypt${salt.hex()}${_scrypt(password, salt).hex()}"


def check_password(password, stored):
    try:
        scheme, salt_hex, hash_hex = str(stored).split("$")
        if scheme != "scrypt":
            return False
        expected = bytes.fromhex(hash_hex)
        return hmac.compare_digest(_scrypt(password, bytes.fromhex(salt_hex)), expected)
    except ValueError:
        return False


_DUMMY = hash_password("not-a-real-password")  # so unknown handles cost the same time as wrong passwords


def public_user(u):
    return {"id": u["id"], "handle": u["handle"], "name": u["name"]}


def self_user(u):
    return {**public_user(u), "email": u.get("email"), "emailVerified": bool(u.get("email_verified"))}


def validate_signup(body):
    h = str(body.get("handle") or "").strip()
    e = str(body.get("email") or "").strip().lower()
    n = str(body.get("name") or "").strip()
    p = str(body.get("password") or "")
    if not HANDLE.match(h):
        raise HttpError(400, "Handle must be 3 to 20 letters, numbers or underscores")
    if len(n) < 1 or len(n) > 40:
        raise HttpError(400, "Enter a display name (up to 40 characters)")
    if len(p) < 8 or len(p) > 200:
        raise HttpError(400, "Password must be at least 8 characters")
    if len(e) > 254 or not EMAIL.match(e):
        raise HttpError(400, "Enter a valid email address")
    return h, n, p, e


# ---- sessions ----

def start_session(user_id):
    """Create a session and return its token (the caller puts it in the cookie)."""
    token = base64.urlsafe_b64encode(os.urandom(32)).rstrip(b"=").decode()
    t = now()
    run("INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)", _sha(token), user_id, t, t + SESSION_MS)
    run("DELETE FROM sessions WHERE expires_at < ?", t)
    return token


def set_session_cookie(response, request: Request, token):
    response.set_cookie(COOKIE, token, max_age=SESSION_MS // 1000, path="/", httponly=True, samesite="lax", secure=is_https(request))


def clear_session_cookie(response, request: Request):
    response.set_cookie(COOKIE, "", max_age=0, path="/", httponly=True, samesite="lax", secure=is_https(request))


def current_user(request: Request):
    token = request.cookies.get(COOKIE)
    if not token:
        return None
    row = one(
        "SELECT u.id, u.handle, u.name, u.email, u.email_verified FROM sessions s JOIN users u ON u.id = s.user_id "
        "WHERE s.token_hash = ? AND s.expires_at > ?",
        _sha(token),
        now(),
    )
    return self_user(row) if row else None


def require_user(request: Request):
    user = current_user(request)
    if not user:
        raise HttpError(401, "Sign in first")
    return user


# ---- links sent by email (confirm address, reset password) ----

def _create_token(user_id, kind, ttl):
    token = base64.urlsafe_b64encode(os.urandom(32)).rstrip(b"=").decode()
    run("DELETE FROM email_tokens WHERE user_id = ? AND kind = ?", user_id, kind)
    run("INSERT INTO email_tokens (token_hash, user_id, kind, expires_at) VALUES (?, ?, ?, ?)", _sha(token), user_id, kind, now() + ttl)
    return token


def _use_token(token, kind):
    row = one("SELECT * FROM email_tokens WHERE token_hash = ? AND kind = ? AND expires_at > ?", _sha(str(token or "")), kind, now())
    if not row:
        raise HttpError(400, "This link is invalid or has expired")
    run("DELETE FROM email_tokens WHERE token_hash = ?", row["token_hash"])
    return row["user_id"]


def app_url(request: Request):
    base = os.environ.get("APP_URL") or f"{'https' if is_https(request) else 'http'}://{request.headers.get('host')}"
    return base.rstrip("/")


def send_verification(request_base, user):
    url = f"{request_base}/#/verify/{_create_token(user['id'], 'verify', 24 * HOUR)}"
    html, text = emailer.verify_email(user["name"], url)
    emailer.send_mail(user["email"], "Confirm your email for ClapBoxes", text, html)


def register(request: Request, body):
    """Returns (user, session token)."""
    handle, name, password, email = validate_signup(body)
    if one("SELECT 1 FROM users WHERE handle = ?", handle):
        raise HttpError(409, "That handle is taken")
    if one("SELECT 1 FROM users WHERE email = ?", email):
        raise HttpError(409, "That email is already registered")
    cur = run("INSERT INTO users (handle, name, email, password_hash, created_at) VALUES (?, ?, ?, ?, ?)", handle, name, email, hash_password(password), now())
    user = {"id": cur.lastrowid, "handle": handle, "name": name, "email": email, "email_verified": 0}
    return self_user(user), start_session(user["id"]), user


def resend_verification(request: Request, user):
    row = one("SELECT * FROM users WHERE id = ?", user["id"])
    if not row["email"]:
        raise HttpError(400, "Add an email address first")
    if row["email_verified"]:
        return
    send_verification(app_url(request), row)


def verify_email_token(token):
    run("UPDATE users SET email_verified = 1 WHERE id = ?", _use_token(token, "verify"))


def forgot_password(request: Request, email):
    row = one("SELECT * FROM users WHERE email = ?", str(email or "").strip().lower())
    if not row:
        return  # the caller answers the same way either way, so addresses cannot be probed
    url = f"{app_url(request)}/#/reset/{_create_token(row['id'], 'reset', HOUR)}"
    html, text = emailer.reset_email(row["name"], url)
    emailer.send_mail(row["email"], "Reset your ClapBoxes password", text, html)


def reset_password(token, password):
    p = str(password or "")
    if len(p) < 8 or len(p) > 200:
        raise HttpError(400, "Password must be at least 8 characters")
    user_id = _use_token(token, "reset")
    run("UPDATE users SET password_hash = ?, email_verified = 1 WHERE id = ?", hash_password(p), user_id)  # reading the email proves the address
    run("DELETE FROM sessions WHERE user_id = ?", user_id)  # sign out everywhere


def login(request: Request, body):
    """Sign in with a handle or an email. Returns (user, session token)."""
    ident = str(body.get("handle") or "").strip()
    row = one("SELECT * FROM users WHERE handle = ? OR (email IS NOT NULL AND email = ?)", ident, ident.lower())
    ok = check_password(str(body.get("password") or ""), row["password_hash"] if row else _DUMMY)
    if not row or not ok:
        raise HttpError(401, "Wrong handle or password")
    return self_user(row), start_session(row["id"])


def logout(request: Request):
    token = request.cookies.get(COOKIE)
    if token:
        run("DELETE FROM sessions WHERE token_hash = ?", _sha(token))
