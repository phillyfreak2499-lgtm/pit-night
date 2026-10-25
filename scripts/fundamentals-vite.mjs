// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- shared runtime JS; behavior is covered by the gate tests.
// @ts-nocheck
import { handleFundamentalsRequest } from "./fundamentals-gate.mjs";
export function fundamentalsPlugin() {
  return {
    name: "pit:fundamentals",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        try {
          const headers = new Headers();
          for (const [key, value] of Object.entries(req.headers))
            if (value !== undefined)
              headers.set(key, Array.isArray(value) ? value.join(",") : value);
          headers.delete("x-vercel-forwarded-for");
          headers.set("x-pit-local-address", req.socket.remoteAddress ?? "local");
          const method = req.method ?? "GET";
          let body;
          if (method === "POST" && (req.url ?? "").split("?")[0] === "/entry") {
            const chunks = [];
            let size = 0;
            for await (const chunk of req) {
              size += chunk.length;
              if (size > 4096) {
                res.statusCode = 413;
                res.end("Answer too long");
                return;
              }
              chunks.push(chunk);
            }
            body = Buffer.concat(chunks);
          }
          const request = new Request("http://" + req.headers.host + req.url, {
            method,
            headers,
            ...(body ? { body } : {}),
          });
          const response = await handleFundamentalsRequest(request, {
            countAttempt: async (request) => {
              const mod = await server.ssrLoadModule("/src/lib/pit/entry-attempts.server.ts");
              return mod.countEntryAttempt(request);
            },
          });
          if (!response) {
            next();
            return;
          }
          res.statusCode = response.status;
          response.headers.forEach((value, key) => {
            if (key !== "set-cookie") res.setHeader(key, value);
          });
          for (const value of response.headers.getSetCookie())
            res.appendHeader("set-cookie", value);
          res.end(Buffer.from(await response.arrayBuffer()));
        } catch (error) {
          console.error("[entry]", error);
          res.statusCode = 503;
          res.end("The entrance is temporarily unavailable.");
        }
      });
    },
  };
}
