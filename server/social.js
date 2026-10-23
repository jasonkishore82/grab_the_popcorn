// People: search, profiles with their Watchcase, friend requests, and chat between friends.
import { db, now } from './db.js';
import { HttpError } from './http.js';
import { libraryFor, resolveId, toJson } from './titles.js';

const like = (s) => s.replace(/[\\%_]/g, '\\$&');
const person = (u) => ({ handle: u.handle, name: u.name });

export function userByHandle(handle) {
  const u = db.prepare('SELECT id, handle, name, created_at FROM users WHERE handle = ?').get(String(handle ?? ''));
  if (!u) throw new HttpError(404, 'Person not found');
  return u;
}

// ---------- friends ----------

function pair(a, b) {
  return db.prepare('SELECT * FROM friendships WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)').get(a, b, b, a);
}

// How `me` relates to `other`: none | friends | requested (I asked) | incoming (they asked)
export function relation(meId, otherId) {
  if (!meId || meId === otherId) return 'none';
  const row = pair(meId, otherId);
  if (!row) return 'none';
  if (row.status === 'accepted') return 'friends';
  return row.user_id === meId ? 'requested' : 'incoming';
}

export const areFriends = (a, b) => relation(a, b) === 'friends';

export function addFriend(meId, handle) {
  const other = userByHandle(handle);
  if (other.id === meId) throw new HttpError(400, 'That is you');
  const row = pair(meId, other.id);
  if (!row) {
    const pending = db.prepare("SELECT COUNT(*) n FROM friendships WHERE user_id = ? AND status = 'pending'").get(meId).n;
    if (Number(pending) >= 50) throw new HttpError(429, 'You have too many pending requests');
    db.prepare("INSERT INTO friendships (user_id, friend_id, status, created_at) VALUES (?, ?, 'pending', ?)").run(meId, other.id, now());
  } else if (row.status === 'pending' && row.friend_id === meId) {
    db.prepare("UPDATE friendships SET status = 'accepted' WHERE user_id = ? AND friend_id = ?").run(row.user_id, row.friend_id); // they asked first
  }
  return { relation: relation(meId, other.id) };
}

// Unfriend, decline, or cancel a request: all remove the row.
export function removeFriend(meId, handle) {
  const other = userByHandle(handle);
  db.prepare('DELETE FROM friendships WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)').run(meId, other.id, other.id, meId);
  return { relation: 'none' };
}

export function listFriends(meId) {
  const rows = db
    .prepare(
      `SELECT u.handle, u.name, f.status, f.user_id AS requester FROM friendships f
       JOIN users u ON u.id = CASE WHEN f.user_id = ? THEN f.friend_id ELSE f.user_id END
       WHERE f.user_id = ? OR f.friend_id = ? ORDER BY u.name`,
    )
    .all(meId, meId, meId);
  return {
    friends: rows.filter((r) => r.status === 'accepted').map(person),
    incoming: rows.filter((r) => r.status === 'pending' && r.requester !== meId).map(person),
    outgoing: rows.filter((r) => r.status === 'pending' && r.requester === meId).map(person),
  };
}

// ---------- finding people ----------

export function searchPeople(me, rawQuery) {
  const q = String(rawQuery ?? '').trim().replace(/^@/, '').slice(0, 40);
  if (q.length < 2) return [];
  const rows = db
    .prepare(
      `SELECT u.id, u.handle, u.name,
              (SELECT COUNT(*) FROM library_entries e WHERE e.user_id = u.id AND e.status = 'watched') AS watched
       FROM users u WHERE (u.handle LIKE ? ESCAPE '\\' OR u.name LIKE ? ESCAPE '\\') AND u.id <> ?
       ORDER BY (u.handle LIKE ? ESCAPE '\\') DESC, u.handle LIMIT 20`,
    )
    .all(`%${like(q)}%`, `%${like(q)}%`, me?.id ?? 0, `${like(q)}%`);
  return rows.map((u) => ({ ...person(u), watched: Number(u.watched), relation: relation(me?.id, u.id) }));
}

// ---------- a person's page: their Watchcase (everything they have watched) ----------

export function profile(me, handle) {
  const u = userByHandle(handle);
  const watched = libraryFor(u.id, 'watched');
  const rated = watched.filter((w) => w.entry.rating > 0);
  return {
    user: { ...person(u), joinedAt: u.created_at },
    isMe: me?.id === u.id,
    relation: relation(me?.id, u.id),
    stats: {
      titlesWatched: watched.length,
      totalWatches: watched.reduce((n, w) => n + w.entry.timesWatched, 0),
      ratings: rated.length,
      averageRating: rated.length ? Math.round((rated.reduce((n, w) => n + w.entry.rating, 0) / rated.length) * 10) / 10 : null,
      reviews: watched.filter((w) => w.entry.review).length,
    },
    watchcase: watched,
  };
}

// ---------- chat ----------

const messageJson = (m, meId) => ({ id: Number(m.id), mine: m.sender_id === meId, text: m.body, titleId: m.title_id, ts: m.created_at });

export function conversations(meId) {
  const { friends } = listFriends(meId);
  const last = db.prepare(
    `SELECT * FROM messages WHERE (sender_id = ? AND recipient_id = ?) OR (sender_id = ? AND recipient_id = ?) ORDER BY id DESC LIMIT 1`,
  );
  const unread = db.prepare('SELECT COUNT(*) n FROM messages WHERE recipient_id = ? AND sender_id = ? AND read_at IS NULL');
  const out = friends.map((f) => {
    const id = userByHandle(f.handle).id;
    const m = last.get(meId, id, id, meId);
    return { ...f, last: m ? messageJson(m, meId) : null, unread: Number(unread.get(meId, id).n) };
  });
  out.sort((a, b) => (b.last?.ts ?? 0) - (a.last?.ts ?? 0));
  return { conversations: out, unread: out.reduce((n, c) => n + c.unread, 0) };
}

function friendOrThrow(meId, handle) {
  const other = userByHandle(handle);
  if (!areFriends(meId, other.id)) throw new HttpError(403, 'You can chat with people once you are friends');
  return other;
}

export function messagesWith(meId, handle, after = 0) {
  const other = friendOrThrow(meId, handle);
  const rows = after
    ? db.prepare('SELECT * FROM messages WHERE id > ? AND ((sender_id = ? AND recipient_id = ?) OR (sender_id = ? AND recipient_id = ?)) ORDER BY id LIMIT 200').all(after, meId, other.id, other.id, meId)
    : db.prepare('SELECT * FROM (SELECT * FROM messages WHERE (sender_id = ? AND recipient_id = ?) OR (sender_id = ? AND recipient_id = ?) ORDER BY id DESC LIMIT 100) ORDER BY id').all(meId, other.id, other.id, meId);
  db.prepare('UPDATE messages SET read_at = ? WHERE recipient_id = ? AND sender_id = ? AND read_at IS NULL').run(now(), meId, other.id);
  return { messages: rows.map((m) => messageJson(m, meId)) };
}

export function sendMessage(meId, handle, { text, titleId }) {
  const other = friendOrThrow(meId, handle);
  const body = String(text ?? '').trim();
  if (!body && !titleId) throw new HttpError(400, 'Write a message first');
  if (body.length > 2000) throw new HttpError(400, 'Messages can be up to 2000 characters');
  let title = null;
  if (titleId) {
    title = resolveId(String(titleId));
    if (!db.prepare('SELECT 1 FROM titles WHERE id = ?').get(title)) throw new HttpError(404, 'Title not found');
  }
  const info = db.prepare('INSERT INTO messages (sender_id, recipient_id, body, title_id, created_at) VALUES (?, ?, ?, ?, ?)').run(meId, other.id, body || 'Check this out', title, now());
  return { message: messageJson(db.prepare('SELECT * FROM messages WHERE id = ?').get(info.lastInsertRowid), meId) };
}
export { toJson };
