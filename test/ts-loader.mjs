import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function hasExtension(specifier) {
  return /\.(?:mjs|cjs|js|jsx|ts|tsx|json|node)$/.test(specifier);
}

function candidateUrls(specifier, parentURL) {
  if (specifier.startsWith("@/")) {
    const base = path.join(rootDir, "src", specifier.slice(2));
    return [pathToFileURL(`${base}.ts`).href, pathToFileURL(path.join(base, "index.ts")).href];
  }

  if ((specifier.startsWith("./") || specifier.startsWith("../")) && !hasExtension(specifier)) {
    const base = new URL(specifier, parentURL);
    return [`${base.href}.ts`, new URL("index.ts", `${base.href}/`).href];
  }

  return [];
}

export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (error) {
    for (const url of candidateUrls(specifier, context.parentURL)) {
      try {
        return await nextResolve(url, context);
      } catch {
        // Try the next candidate.
      }
    }
    throw error;
  }
}
