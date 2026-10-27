"""People: search, profiles with their Watchcase, friend requests, and chat between friends."""
import base64
import binascii
import hashlib
import re

from .db import many, now, one, run, scalar
from .http_util import HttpError
from .titles import library_for, resolve_id

DOME_LIMIT = 40


def _like(s):
    return re.sub(r"([\\%_])", r"\\\1", s)


def person(u):
    return {"handle": u["handle"], "name": u["name"]}


def user_by_handle(handle):
    u = one("SELECT id, handle, name, bio, avatar, created_at FROM users WHERE handle = ?", str(handle or ""))
    if not u:
        raise HttpError(404, "Person not found")
    return u


# ---------- friends ----------

def _pair(a, b):
    return one("SELECT * FROM friendships WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)", a, b, b, a)


def relation(me_id, other_id):
    """How `me` relates to `other`: none | friends | requested (I asked) | incoming (they asked)"""
    if not me_id or me_id == other_id:
        return "none"
    row = _pair(me_id, other_id)
    if not row:
        return "none"
    if row["status"] == "accepted":
        return "friends"
    return "requested" if row["user_id"] == me_id else "incoming"


def are_friends(a, b):
    return relation(a, b) == "friends"


def add_friend(me_id, handle):
    other = user_by_handle(handle)
    if other["id"] == me_id:
        raise HttpError(400, "That is you")
    row = _pair(me_id, other["id"])
    if not row:
        pending = scalar("SELECT COUNT(*) FROM friendships WHERE user_id = ? AND status = 'pending'", me_id)
        if pending >= 50:
            raise HttpError(429, "You have too many pending requests")
        run("INSERT INTO friendships (user_id, friend_id, status, created_at) VALUES (?, ?, 'pending', ?)", me_id, other["id"], now())
    elif row["status"] == "pending" and row["friend_id"] == me_id:
        run("UPDATE friendships SET status = 'accepted' WHERE user_id = ? AND friend_id = ?", row["user_id"], row["friend_id"])  # they asked first
    return {"relation": relation(me_id, other["id"])}


def remove_friend(me_id, handle):
    """Unfriend, decline, or cancel a request: all remove the row."""
    other = user_by_handle(handle)
    run("DELETE FROM friendships WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)", me_id, other["id"], other["id"], me_id)
    # Only friends can be in a dome, so ending the friendship takes each of you out of the other's.
    run("DELETE FROM dome_members WHERE (owner_id = ? AND member_id = ?) OR (owner_id = ? AND member_id = ?)", me_id, other["id"], other["id"], me_id)
    return {"relation": "none"}


def list_friends(me_id):
    rows = many(
        """SELECT u.handle, u.name, u.avatar, f.status, f.user_id AS requester FROM friendships f
       JOIN users u ON u.id = CASE WHEN f.user_id = ? THEN f.friend_id ELSE f.user_id END
       WHERE f.user_id = ? OR f.friend_id = ? ORDER BY u.name""",
        me_id, me_id, me_id,
    )
    return {
        "friends": [dome_person(r) for r in rows if r["status"] == "accepted"],
        "incoming": [person(r) for r in rows if r["status"] == "pending" and r["requester"] != me_id],
        "outgoing": [person(r) for r in rows if r["status"] == "pending" and r["requester"] == me_id],
    }


# ---------- finding people ----------

def search_people(me, raw_query):
    q = str(raw_query or "").strip()
    q = q[1:] if q.startswith("@") else q
    q = q[:40]
    if len(q) < 2:
        return []
    rows = many(
        """SELECT u.id, u.handle, u.name,
              (SELECT COUNT(*) FROM library_entries e WHERE e.user_id = u.id AND e.status = 'watched') AS watched
       FROM users u WHERE (u.handle LIKE ? ESCAPE '\\' OR u.name LIKE ? ESCAPE '\\') AND u.id <> ?
       ORDER BY (u.handle LIKE ? ESCAPE '\\') DESC, u.handle LIMIT 20""",
        f"%{_like(q)}%", f"%{_like(q)}%", me["id"] if me else 0, f"{_like(q)}%",
    )
    me_id = me["id"] if me else None
    return [{**person(u), "watched": int(u["watched"]), "relation": relation(me_id, u["id"])} for u in rows]


# ---------- a person's page: their Watchcase (everything they have watched) ----------

def profile(me, handle):
    u = user_by_handle(handle)
    watched = library_for(u["id"], "watched")
    rated = [w for w in watched if w["entry"]["rating"] > 0]
    me_id = me["id"] if me else None
    avg = None
    if rated:
        avg = int(sum(w["entry"]["rating"] for w in rated) / len(rated) * 10 + 0.5) / 10
    return {
        "user": {**person(u), "bio": u["bio"] or "", "avatar": u["avatar"], "joinedAt": u["created_at"]},
        "isMe": me_id == u["id"],
        "relation": relation(me_id, u["id"]),
        "stats": {
            "titlesWatched": len(watched),
            "totalWatches": sum(w["entry"]["timesWatched"] for w in watched),
            "ratings": len(rated),
            "averageRating": avg,
            "reviews": len([w for w in watched if w["entry"]["review"]]),
            "friends": int(scalar("SELECT COUNT(*) FROM friendships WHERE status = 'accepted' AND (user_id = ? OR friend_id = ?)", u["id"], u["id"])),
        },
        "watchcase": watched,
    }


# ---------- chat ----------

def _message_json(m, me_id):
    return {"id": int(m["id"]), "mine": m["sender_id"] == me_id, "text": m["body"], "titleId": m["title_id"], "ts": m["created_at"]}


def conversations(me_id):
    friends = list_friends(me_id)["friends"]
    out = []
    for f in friends:
        fid = user_by_handle(f["handle"])["id"]
        m = one(
            "SELECT * FROM messages WHERE (sender_id = ? AND recipient_id = ?) OR (sender_id = ? AND recipient_id = ?) ORDER BY id DESC LIMIT 1",
            me_id, fid, fid, me_id,
        )
        unread = int(scalar("SELECT COUNT(*) FROM messages WHERE recipient_id = ? AND sender_id = ? AND read_at IS NULL", me_id, fid))
        out.append({**f, "last": _message_json(m, me_id) if m else None, "unread": unread})
    out.sort(key=lambda c: (c["last"]["ts"] if c["last"] else 0), reverse=True)
    return {"conversations": out, "unread": sum(c["unread"] for c in out)}


def _friend_or_throw(me_id, handle):
    other = user_by_handle(handle)
    if not are_friends(me_id, other["id"]):
        raise HttpError(403, "You can chat with people once you are friends")
    return other


def messages_with(me_id, handle, after=0):
    other = _friend_or_throw(me_id, handle)
    if after:
        rows = many(
            "SELECT * FROM messages WHERE id > ? AND ((sender_id = ? AND recipient_id = ?) OR (sender_id = ? AND recipient_id = ?)) ORDER BY id LIMIT 200",
            after, me_id, other["id"], other["id"], me_id,
        )
    else:
        rows = many(
            "SELECT * FROM (SELECT * FROM messages WHERE (sender_id = ? AND recipient_id = ?) OR (sender_id = ? AND recipient_id = ?) ORDER BY id DESC LIMIT 100) ORDER BY id",
            me_id, other["id"], other["id"], me_id,
        )
    run("UPDATE messages SET read_at = ? WHERE recipient_id = ? AND sender_id = ? AND read_at IS NULL", now(), me_id, other["id"])
    return {"messages": [_message_json(m, me_id) for m in rows]}


def send_message(me_id, handle, body):
    other = _friend_or_throw(me_id, handle)
    text = str(body.get("text") or "").strip()
    title_id = body.get("titleId")
    if not text and not title_id:
        raise HttpError(400, "Write a message first")
    if len(text) > 2000:
        raise HttpError(400, "Messages can be up to 2000 characters")
    title = None
    if title_id:
        title = resolve_id(str(title_id))
        if not one("SELECT 1 FROM titles WHERE id = ?", title):
            raise HttpError(404, "Title not found")
    cur = run(
        "INSERT INTO messages (sender_id, recipient_id, body, title_id, created_at) VALUES (?, ?, ?, ?, ?)",
        me_id, other["id"], text or "Check this out", title, now(),
    )
    return {"message": _message_json(one("SELECT * FROM messages WHERE id = ?", cur.lastrowid), me_id)}


# Bio and profile photo (a small image stored with the account).
AVATAR = re.compile(r"^data:image/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$")


def update_profile(me_id, body):
    if "bio" in body:
        bio = body["bio"]
        if not isinstance(bio, str) or len(bio.strip()) > 160:
            raise HttpError(400, "Bio can be up to 160 characters")
        run("UPDATE users SET bio = ? WHERE id = ?", bio.strip() or None, me_id)
    if "avatar" in body:
        avatar = body["avatar"]
        if avatar is not None and (not isinstance(avatar, str) or len(avatar) > 200_000 or not AVATAR.match(avatar)):
            raise HttpError(400, "Use a JPEG, PNG or WebP photo under about 150 KB")
        run("UPDATE users SET avatar = ? WHERE id = ?", avatar, me_id)
    return {"ok": True}


# ---------- Friends Dome ----------

def _avatar_tag(avatar):
    return hashlib.sha1(avatar.encode()).hexdigest()[:10]


def avatar_for(handle):
    """Pictures are served as their own cacheable images, so a dome response stays small."""
    u = user_by_handle(handle)
    m = re.match(r"^data:(image/(?:jpeg|png|webp));base64,(.+)$", u["avatar"] or "", re.S)
    if not m:
        raise HttpError(404, "No picture")
    try:
        data = base64.b64decode(m.group(2))
    except (binascii.Error, ValueError):
        raise HttpError(404, "No picture")
    return {"type": m.group(1), "bytes": data, "tag": f'"{_avatar_tag(u["avatar"])}"'}


def dome_person(u):
    return {**person(u), "avatarUrl": f"/api/users/{u['handle']}/avatar?v={_avatar_tag(u['avatar'])}" if u.get("avatar") else None}


def dome_of(handle):
    """Anyone can see a dome, like a profile. Members who stopped being friends are never listed."""
    owner = user_by_handle(handle)
    rows = many(
        """SELECT u.handle, u.name, u.avatar FROM dome_members d
       JOIN users u ON u.id = d.member_id
       WHERE d.owner_id = ? ORDER BY d.added_at, u.handle""",
        owner["id"],
    )
    return {"owner": person(owner), "limit": DOME_LIMIT, "members": [dome_person(r) for r in rows]}


def add_to_dome(me_id, handle):
    other = user_by_handle(handle)
    if not are_friends(me_id, other["id"]):
        raise HttpError(403, "You can only add friends to your dome")
    if not one("SELECT 1 FROM dome_members WHERE owner_id = ? AND member_id = ?", me_id, other["id"]):
        n = int(scalar("SELECT COUNT(*) FROM dome_members WHERE owner_id = ?", me_id))
        if n >= DOME_LIMIT:
            raise HttpError(409, f"Your dome is full ({DOME_LIMIT} friends)")
        run("INSERT INTO dome_members (owner_id, member_id, added_at) VALUES (?, ?, ?)", me_id, other["id"], now())
    return dome_of(one("SELECT handle FROM users WHERE id = ?", me_id)["handle"])


def remove_from_dome(me_id, handle):
    other = user_by_handle(handle)
    run("DELETE FROM dome_members WHERE owner_id = ? AND member_id = ?", me_id, other["id"])
    return dome_of(one("SELECT handle FROM users WHERE id = ?", me_id)["handle"])
