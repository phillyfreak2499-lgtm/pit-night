/**
 * Pre-launch gate. Every request gets a "coming next period" holding page
 * until the league is opened. To launch: set Vercel env SITE_OPEN=1 and
 * redeploy (or delete this file). Nothing else is changed.
 */
const HOLDING_HTML = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>The Waterman Battle Bot League</title>
<style>html,body{margin:0;height:100%;background:#0e0d0b;color:#f3efe6;font-family:Oswald,Impact,Arial,sans-serif}
main{min-height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:24px}
h1{font-size:clamp(32px,7vw,72px);letter-spacing:.04em;margin:0 0 12px;text-transform:uppercase}
p{font-size:clamp(16px,3vw,24px);color:#e8a33d;letter-spacing:.2em;text-transform:uppercase;margin:0}</style>
</head><body><main><h1>The Waterman Battle Bot League</h1><p>Coming next period</p></main></body></html>`;

export default async function launchGate(
  _event: unknown,
  next: () => Promise<Response> | Response,
): Promise<Response> {
  if (process.env.SITE_OPEN === "1") return next();
  return new Response(HOLDING_HTML, {
    status: 503,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "retry-after": "86400",
      "x-robots-tag": "noindex",
    },
  });
}
