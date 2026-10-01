import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { resolve as pathResolve } from "node:path";
const root = fileURLToPath(new URL("../", import.meta.url));
export async function resolve(specifier, context, next) {
  if (specifier.startsWith("@/"))
    specifier = pathToFileURL(pathResolve(root, "src", specifier.slice(2))).href;
  if ((specifier.startsWith(".") || specifier.startsWith("file:")) && context.parentURL) {
    const url = new URL(specifier, context.parentURL);
    if (!/\.[a-z]+$/i.test(url.pathname) && existsSync(fileURLToPath(url) + ".ts"))
      return { url: url.href + ".ts", shortCircuit: true };
  }
  return next(specifier, context);
}
