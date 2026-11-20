/** Minimal client for the local Mailpit inbox started by `supabase start`. */
const MAILPIT = "http://127.0.0.1:54324/api/v1";

type Summary = { ID: string; To: { Address: string }[]; Subject: string };

export async function waitForEmailLink(to: string, { timeoutMs = 20_000, after = 0 } = {}): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const res = await fetch(`${MAILPIT}/search?query=${encodeURIComponent(`to:"${to}"`)}`);
    const { messages } = (await res.json()) as { messages: Summary[] };
    if (messages.length > after) {
      const latest = messages[0];
      const msg = (await (await fetch(`${MAILPIT}/message/${latest.ID}`)).json()) as { HTML: string; Text: string };
      const body = msg.HTML || msg.Text;
      const match = /href="([^"]*\/auth\/v1\/verify[^"]*)"/.exec(body) ?? /(http\S*\/auth\/v1\/verify\S*)/.exec(body);
      if (match) return match[1].replaceAll("&amp;", "&");
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`No email received for ${to}`);
}

export async function countEmails(to: string): Promise<number> {
  const res = await fetch(`${MAILPIT}/search?query=${encodeURIComponent(`to:"${to}"`)}`);
  return ((await res.json()) as { messages: Summary[] }).messages.length;
}
