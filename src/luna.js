// Browser side of Luna: streams a reply from the server's /api/luna endpoint.
const ERROR_MARK = '\n\n[error] '; // must match server/luna.js

export async function askLuna({ history, context, onText, signal }) {
  // Don't resend error notices to the model.
  const messages = history.map((m) => ({ role: m.role, content: m.content.split(ERROR_MARK)[0] }));
  let res;
  try {
    res = await fetch('/api/luna', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, context }),
      signal,
    });
  } catch (e) {
    if (e.name === 'AbortError') return;
    return onText(`${ERROR_MARK}Can't reach Luna. Is the server running?`);
  }
  const type = res.headers.get('content-type') || '';
  if (!res.ok || !type.startsWith('text/plain')) {
    return onText(`${ERROR_MARK}Luna isn't available here. Run the app with \`npm run dev\` or \`npm start\`.`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    onText(decoder.decode(value, { stream: true }));
  }
}

export const isError = (text) => text.includes(ERROR_MARK);

// Splits a reply into the normal text and an optional error notice.
export function splitError(text) {
  const i = text.indexOf(ERROR_MARK);
  return i < 0 ? [text, null] : [text.slice(0, i), text.slice(i + ERROR_MARK.length)];
}
