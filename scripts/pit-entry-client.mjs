/** Disposable loopback QA only: complete the same entrance form a user sees. */
export async function enterLocalPit(base) {
  if (!["localhost", "127.0.0.1"].includes(new URL(base).hostname))
    throw new Error("Entry QA is loopback-only.");
  const response = await fetch(base + "/entry");
  const html = await response.text();
  const n = Number(html.match(/What is key fundamental #(\d)/)?.[1]);
  const challenge = response.headers
    .getSetCookie()
    .find((x) => x.startsWith("pit_challenge="))
    ?.split(";")[0];
  if (!challenge || !n) throw new Error("The entry form did not issue a challenge.");
  const answers = [
    "",
    "seat everyone instantly",
    "fit everyone",
    "close 3 step systems",
    "follow up with each client",
    "get referrals and reviews",
  ];
  const pass = await fetch(base + "/entry", {
    method: "POST",
    redirect: "manual",
    headers: {
      origin: base,
      cookie: challenge,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ answer: answers[n] ?? "", next: "/" }),
  });
  const cookie = pass.headers
    .getSetCookie()
    .find((x) => x.startsWith("pit_entry="))
    ?.split(";")[0];
  if (pass.status !== 303 || !cookie) throw new Error("Local entry check failed: " + pass.status);
  return cookie;
}
