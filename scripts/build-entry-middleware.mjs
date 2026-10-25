// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- shared runtime JS; behavior is covered by the gate tests.
// @ts-nocheck
// Vercel's filesystem routes precede Nitro. Protect them before CDN lookup.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { pathToFileURL } from "node:url";
export async function buildEntryMiddleware(root = ".vercel/output") {
  const config = JSON.parse(await readFile(root + "/config.json", "utf8"));
  const cryptoSource = (
    await readFile(new URL("./entry-crypto.mjs", import.meta.url), "utf8")
  ).replaceAll("export ", "");
  const fn = root + "/functions/__entrance.func";
  await mkdir(fn, { recursive: true });
  await writeFile(
    fn + "/.vc-config.json",
    JSON.stringify({
      runtime: "edge",
      entrypoint: "index.mjs",
      envVarsInUse: ["PIT_CODE_VAULT_KEY"],
    }),
  );
  await writeFile(
    fn + "/index.mjs",
    cryptoSource +
      `
export default async function middleware(request) {
  const url=new URL(request.url);
  const headers={'cache-control':'no-store','vary':'Cookie'};
  if(platformPath(url.pathname)||url.pathname==='/entry') return new Response(null,{headers:{'x-middleware-next':'1'}});
  if(await entryAllowed(request,process.env.PIT_CODE_VAULT_KEY)) return new Response(null,{headers:{'x-middleware-next':'1'}});
  if(request.method==='GET'&&request.headers.get('accept')?.includes('text/html')) return new Response(null,{status:303,headers:{...headers,location:'/entry?next='+encodeURIComponent(url.pathname+url.search)}});
  return new Response('Complete the fundamentals check at /entry.',{status:401,headers});
}`,
  );
  config.routes = [
    { src: "/(.*)", middlewarePath: "__entrance", continue: true },
    ...config.routes.filter((route) => route.middlewarePath !== "__entrance"),
  ];
  await writeFile(root + "/config.json", JSON.stringify(config, null, 2));
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  await buildEntryMiddleware();
