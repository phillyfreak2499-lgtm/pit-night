import { handleFundamentalsRequest } from "../../scripts/fundamentals-gate.mjs";
import { countEntryAttempt } from "../../src/lib/pit/entry-attempts.server";
export default async function fundamentals(
  event: { url: URL; req: Request },
  next: () => Promise<Response>,
) {
  const response = await handleFundamentalsRequest(new Request(event.url, event.req), {
    countAttempt: countEntryAttempt,
  });
  return response ?? next();
}
