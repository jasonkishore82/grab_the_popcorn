// Luna: the in-app movie assistant. Runs on the server so the API key never reaches the browser.
import Anthropic from '@anthropic-ai/sdk';
import { TITLES, USERS } from '../src/data.js';

const MODEL = 'claude-opus-5-5';
const MAX_HISTORY = 30;
const ERROR_MARK = '\n\n[error] '; // the browser shows text after this as an error notice

let client;
const getClient = () => (client ??= new Anthropic());

const catalog = TITLES.map(
  (t) => `- ${t.title} (${t.year}, ${t.type === 'show' ? 'series' : 'film'}; ${t.genres.join('/')}; critics ${t.critics}%, audience ${t.audience}%): ${t.synopsis}`,
).join('\n');

// Stable, cacheable instructions + catalog. Per-user context goes in a second block.
const SYSTEM = `You are Luna, the friendly movie and TV assistant inside "Grab the Popcorn", an app where people save favourite movies and shows, rate and review them, and chat with friends about them.

Help with recommendations, quick facts, "what should I watch tonight", comparisons, spoiler-free summaries, and conversation starters to send to friends.

Style:
- Warm and concise. Usually 2-6 short sentences or a short list. Plain text with light markdown (bold, bullet lists) only.
- Never use emoji.
- Never spoil plot twists or endings unless the user explicitly asks for spoilers.
- When you recommend something from the app's catalog below, write its title exactly as listed so the app can link it. You may mention titles outside the catalog, but say they aren't in the app yet.
- If you're unsure about a fact, say so rather than guessing.

App catalog:
${catalog}`;

function userContext({ library = {}, friends = [] } = {}) {
  const lines = Object.entries(library)
    .map(([id, v]) => {
      const t = TITLES.find((x) => x.id === id) ?? (typeof v.title === 'string' ? { title: v.title.slice(0, 120) } : null);
      if (!t) return null;
      const rating = v.rating ? `, rated ${v.rating}/5` : '';
      const review = v.review ? `, review: "${String(v.review).slice(0, 200)}"` : '';
      return `- ${t.title}: ${v.status === 'watched' ? 'watched' : 'on watchlist'}${rating}${review}`;
    })
    .filter(Boolean);
  const pals = friends
    .map((id) => USERS.find((u) => u.id === id))
    .filter(Boolean)
    .map((u) => `- ${u.name} (@${u.handle}): ${u.bio} Favourites: ${u.favs.map((f) => TITLES.find((t) => t.id === f)?.title).join(', ')}`);
  return `The user's list:\n${lines.join('\n') || '- (empty)'}\n\nThe user's friends:\n${pals.join('\n') || '- (none yet)'}`;
}

function cleanMessages(messages) {
  if (!Array.isArray(messages)) return [];
  const out = messages
    .filter((m) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .slice(-MAX_HISTORY)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }));
  while (out.length && out[0].role !== 'user') out.shift();
  return out;
}

async function readJson(req) {
  let body = '';
  for await (const chunk of req) {
    body += chunk;
    if (body.length > 200_000) throw new Error('Request too large');
  }
  return JSON.parse(body || '{}');
}

// Node-style (req, res) handler. Streams plain-text chunks back to the browser.
export async function handleLuna(req, res) {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    return res.end();
  }

  let payload;
  try {
    payload = await readJson(req);
  } catch {
    res.statusCode = 400;
    return res.end('Bad request');
  }

  const messages = cleanMessages(payload.messages);
  if (!messages.length || messages.at(-1).role !== 'user') {
    res.statusCode = 400;
    return res.end('Send at least one user message');
  }

  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-cache' });

  try {
    const stream = getClient().beta.messages.stream({
      model: MODEL,
      max_tokens: 4000,
      output_config: { effort: 'low' }, // chat: keep it fast and cheap
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default', // retry on a fallback model if a request is declined
      system: [
        { type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } },
        { type: 'text', text: userContext(payload.context) },
      ],
      messages,
    });

    req.on('close', () => stream.abort());

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        res.write(event.delta.text);
      }
    }

    const final = await stream.finalMessage();
    if (final.stop_reason === 'refusal') {
      res.write("\n\nSorry, I can't help with that one. Ask me about something else to watch?");
    } else if (final.stop_reason === 'max_tokens') {
      res.write('…');
    }
    res.end();
  } catch (err) {
    if (err instanceof Anthropic.APIUserAbortError) return;
    console.error('[luna]', err?.status ?? '', err?.message);
    let msg = 'Luna is having trouble right now. Try again in a moment.';
    if (err instanceof Anthropic.AuthenticationError) msg = 'Luna is not set up: the server has no valid ANTHROPIC_API_KEY.';
    else if (err instanceof Anthropic.RateLimitError) msg = 'Luna is busy right now. Try again in a few seconds.';
    else if (!(err instanceof Anthropic.APIError) && /api key|apiKey|authToken/i.test(String(err?.message)))
      msg = 'Luna is not set up: the server has no ANTHROPIC_API_KEY.';
    res.write(`${ERROR_MARK}${msg}`);
    res.end();
  }
}
