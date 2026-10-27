"""ClapBoxes API (FastAPI). One shared database serves every user.

Development:  python -m uvicorn backend.main:app --port 47123      (Vite proxies /api to it)
Production:   npm run build, then the same command: this server also serves the built app from dist/.
"""
import re
import threading
from pathlib import Path

from fastapi import FastAPI, Request, Response
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import FileResponse, JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from . import auth, config, db, emailer, omdb, social, titles  # noqa: F401  (config loads .env first)
from .http_util import HttpError, client_ip, limiter, read_json, same_origin

db.init()
titles.seed_starter_titles()

auth_limit = limiter(12, 10 * 60 * 1000)  # sign-in and sign-up attempts per address
omdb_search_limit = limiter(30, 10 * 60 * 1000)  # lookups that would spend OMDb requests, per address
chat_limit = limiter(60, 60 * 1000)  # messages per user per minute
people_limit = limiter(60, 60 * 1000)
resend_limit = limiter(3, 60 * 60 * 1000)

KINDS = {"all", "movie", "show"}
HANDLE = re.compile(r"^[A-Za-z0-9_]{3,20}$")
TITLE_ID = re.compile(r"^[A-Za-z0-9]+$")
TOO_MANY = "Too many attempts. Try again in a few minutes."

app = FastAPI(title="ClapBoxes API", docs_url=None, redoc_url=None, openapi_url=None)


@app.on_event("startup")
def _background_work():
    def go():
        try:
            titles.prune_old_searches()
            titles.warm_starter_titles()
        except Exception as e:
            print("[warm]", e, flush=True)

    threading.Thread(target=go, daemon=True).start()


# ---------- errors and shared behaviour ----------

@app.exception_handler(HttpError)
async def _http_error(request: Request, e: HttpError):
    return JSONResponse({"error": e.message, **e.extra}, status_code=e.status, headers={"Cache-Control": "no-store"})


@app.exception_handler(StarletteHTTPException)
async def _starlette_error(request: Request, e: StarletteHTTPException):
    message = "Not found" if e.status_code in (404, 405) else str(e.detail)
    return JSONResponse({"error": message}, status_code=404 if e.status_code == 405 else e.status_code)


@app.exception_handler(Exception)
async def _unexpected(request: Request, e: Exception):
    print("[api]", request.method, request.url.path, repr(e), flush=True)
    return JSONResponse({"error": "Something went wrong"}, status_code=500)


@app.middleware("http")
async def _api_rules(request: Request, call_next):
    if request.url.path.startswith("/api") and request.method != "GET" and not same_origin(request):
        return JSONResponse({"error": "Cross-site request blocked"}, status_code=403)
    response = await call_next(request)
    if request.url.path.startswith("/api") and "cache-control" not in response.headers:
        response.headers["Cache-Control"] = "no-store"
    return response


def work(fn, *args):
    """Database and OMDb calls are blocking, so they run in a worker thread."""
    return run_in_threadpool(fn, *args)


def handle_of(value):
    if not HANDLE.match(value):
        raise HttpError(404, "Not found")
    return value


def title_of(value):
    if not TITLE_ID.match(value):
        raise HttpError(404, "Not found")
    return value


def reply(body, status=200):
    return JSONResponse(body, status_code=status)


def user_now(request):
    return auth.current_user(request)


# ---------- health ----------

@app.get("/api/health")
async def health():
    return reply({"ok": True, "omdb": omdb.configured()})


# ---------- accounts ----------

@app.post("/api/auth/register")
async def register(request: Request):
    if not auth_limit(client_ip(request)):
        raise HttpError(429, TOO_MANY)
    body = await read_json(request)
    user, token, row = await work(auth.register, request, body)
    base = auth.app_url(request)

    def send():  # never block sign-up on email
        try:
            auth.send_verification(base, row)
        except Exception as e:
            print("[email]", e, flush=True)

    threading.Thread(target=send, daemon=True).start()
    response = reply({"user": user}, 201)
    auth.set_session_cookie(response, request, token)
    return response


@app.post("/api/auth/login")
async def login(request: Request):
    if not auth_limit(client_ip(request)):
        raise HttpError(429, TOO_MANY)
    user, token = await work(auth.login, request, await read_json(request))
    response = reply({"user": user})
    auth.set_session_cookie(response, request, token)
    return response


@app.post("/api/auth/logout")
async def logout(request: Request):
    await work(auth.logout, request)
    response = reply({"ok": True})
    auth.clear_session_cookie(response, request)
    return response


@app.get("/api/auth/me")
async def me(request: Request):
    user = await work(auth.current_user, request)
    return reply({"user": user, "omdb": omdb.configured(), "email": emailer.configured()})


@app.post("/api/auth/verify")
async def verify(request: Request):
    await work(auth.verify_email_token, (await read_json(request)).get("token"))
    return reply({"ok": True})


@app.post("/api/auth/forgot")
async def forgot(request: Request):
    if not auth_limit(client_ip(request)):
        raise HttpError(429, TOO_MANY)
    email = (await read_json(request)).get("email")
    try:
        await work(auth.forgot_password, request, email)
    except Exception as e:
        print("[email]", e, flush=True)
    return reply({"ok": True})  # same answer whether or not the address exists


@app.post("/api/auth/reset")
async def reset(request: Request):
    if not auth_limit(client_ip(request)):
        raise HttpError(429, TOO_MANY)
    body = await read_json(request)
    await work(auth.reset_password, body.get("token"), body.get("password"))
    return reply({"ok": True})


@app.post("/api/auth/resend")
async def resend(request: Request):
    user = await work(auth.require_user, request)
    if not resend_limit(f"u{user['id']}"):
        raise HttpError(429, "Please wait before asking for another email")
    await work(auth.resend_verification, request, user)
    return reply({"ok": True})


# ---------- people, friends, chat ----------

@app.get("/api/users")
async def users(request: Request, q: str = ""):
    if not people_limit(client_ip(request)):
        raise HttpError(429, "Slow down a little")
    me_ = await work(auth.current_user, request)
    return reply({"people": await work(social.search_people, me_, q)})


@app.get("/api/users/{handle}/avatar")
async def avatar(request: Request, handle: str):
    a = await work(social.avatar_for, handle_of(handle))
    headers = {"Cache-Control": "public, max-age=0, must-revalidate", "ETag": a["tag"]}
    if request.headers.get("if-none-match") == a["tag"]:
        return Response(status_code=304, headers=headers)
    return Response(a["bytes"], media_type=a["type"], headers={**headers, "X-Content-Type-Options": "nosniff"})


@app.get("/api/users/{handle}/dome")
async def user_dome(handle: str):
    return reply(await work(social.dome_of, handle_of(handle)))


@app.get("/api/dome")
async def my_dome(request: Request):
    user = await work(auth.require_user, request)
    return reply(await work(social.dome_of, user["handle"]))


@app.put("/api/dome/{handle}")
async def dome_add(request: Request, handle: str):
    user = await work(auth.require_user, request)
    return reply(await work(social.add_to_dome, user["id"], handle_of(handle)))


@app.delete("/api/dome/{handle}")
async def dome_remove(request: Request, handle: str):
    user = await work(auth.require_user, request)
    return reply(await work(social.remove_from_dome, user["id"], handle_of(handle)))


@app.get("/api/users/{handle}")
async def user_profile(request: Request, handle: str):
    me_ = await work(auth.current_user, request)
    return reply(await work(social.profile, me_, handle_of(handle)))


@app.put("/api/me/profile")
async def update_profile(request: Request):
    user = await work(auth.require_user, request)
    return reply(await work(social.update_profile, user["id"], await read_json(request, 300_000)))


@app.get("/api/friends")
async def friends(request: Request):
    user = await work(auth.require_user, request)
    return reply(await work(social.list_friends, user["id"]))


@app.post("/api/friends/{handle}")
async def friend_add(request: Request, handle: str):
    user = await work(auth.require_user, request)
    return reply(await work(social.add_friend, user["id"], handle_of(handle)))


@app.delete("/api/friends/{handle}")
async def friend_remove(request: Request, handle: str):
    user = await work(auth.require_user, request)
    return reply(await work(social.remove_friend, user["id"], handle_of(handle)))


@app.get("/api/chats")
async def chats(request: Request):
    user = await work(auth.require_user, request)
    return reply(await work(social.conversations, user["id"]))


@app.get("/api/chats/{handle}")
async def chat_get(request: Request, handle: str, after: str = "0"):
    user = await work(auth.require_user, request)
    try:
        after_id = int(float(after))
    except ValueError:
        after_id = 0
    return reply(await work(social.messages_with, user["id"], handle_of(handle), after_id))


@app.post("/api/chats/{handle}")
async def chat_send(request: Request, handle: str):
    user = await work(auth.require_user, request)
    if not chat_limit(f"u{user['id']}"):
        raise HttpError(429, "You are sending messages very quickly. Wait a moment.")
    return reply(await work(social.send_message, user["id"], handle_of(handle), await read_json(request)), 201)


# ---------- the shared catalogue (anyone can read) ----------

def _int(value, default):
    try:
        return int(float(value)) or default
    except (TypeError, ValueError):
        return default


@app.get("/api/catalog")
async def catalog(limit: str = "", offset: str = ""):
    def load():
        return {"titles": titles.catalog(_int(limit, 200), _int(offset, 0)), "aliases": titles.id_aliases(), "omdb": omdb.configured()}

    return reply(await work(load))


@app.get("/api/search")
async def search(request: Request, q: str = "", kind: str = "all"):
    if kind not in KINDS:
        raise HttpError(400, "kind must be all, movie or show")
    user = await work(auth.current_user, request)
    allow = omdb_search_limit(f"u{user['id']}" if user else client_ip(request))
    return reply(await work(lambda: titles.search(q, kind, user["id"] if user else None, allow)))


@app.get("/api/titles/{title_id}")
async def title_full(request: Request, title_id: str):
    tid = title_of(title_id)
    user = await work(auth.current_user, request)
    data = await work(titles.get_title_full, tid, user)
    return reply({**data, "requestedId": tid})


# ---------- your own entries: watchlist, watched, rating, comment ----------

@app.put("/api/titles/{title_id}/entry")
async def entry_put(request: Request, title_id: str):
    user = await work(auth.require_user, request)
    return reply(await work(titles.put_entry, user["id"], title_of(title_id), await read_json(request)))


@app.delete("/api/titles/{title_id}/entry")
async def entry_delete(request: Request, title_id: str):
    user = await work(auth.require_user, request)
    return reply(await work(titles.delete_entry, user["id"], title_of(title_id)))


@app.get("/api/me/library")
async def library(request: Request):
    user = await work(auth.require_user, request)
    return reply({"entries": await work(titles.library_for, user["id"])})


@app.api_route("/api/{rest:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH"])
async def api_not_found(rest: str):
    raise HttpError(404, "Not found")


# ---------- the built app (npm run build), served in production ----------

DIST = (config.ROOT / "dist").resolve()


@app.get("/{path:path}")
async def spa(path: str):
    if DIST.is_dir():
        file = (DIST / path).resolve()
        if path and file.is_file() and DIST in file.parents:
            return FileResponse(file)
        index = DIST / "index.html"
        if index.is_file():
            return FileResponse(index)
    return JSONResponse({"error": "Not found. Run npm run build to serve the app from here, or use npm run dev."}, status_code=404)
