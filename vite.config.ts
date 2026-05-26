import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv, mergeConfig, type UserConfig } from "vite";
import tsConfigPaths from "vite-tsconfig-paths";

const projectRoot = fileURLToPath(new URL(".", import.meta.url));
const SANDBOX_ENV_VAR = "DEV_SERVER__PROJECT_PATH";

function isSandboxEnvironment() {
  return Boolean(process.env[SANDBOX_ENV_VAR]);
}

function viteEnvDefines(mode: string) {
  const loadedEnv = loadEnv(mode, process.cwd(), "VITE_");
  return Object.fromEntries(
    Object.entries(loadedEnv).map(([key, value]) => [`import.meta.env.${key}`, JSON.stringify(value)]),
  );
}

function devServerFnErrorLogger() {
  const HMR_SEND_KEY = "__TANSTACK_SERVER_FN_HMR_SEND__";

  return {
    name: "dev-server-fn-error-logger",
    apply: "serve" as const,
    enforce: "pre" as const,
    configureServer(server: any) {
      (globalThis as any)[HMR_SEND_KEY] = (data: unknown) => {
        server.ws.send({
          type: "custom",
          event: "server-fn-error",
          data,
        });
      };
    },
    transform(code: string, id: string) {
      const normalizedId = id.replace(/\\/g, "/");
      const isTargetModule =
        normalizedId.includes("/@tanstack/start-server-core/src/server-functions-handler.ts") ||
        normalizedId.includes("/@tanstack/start-server-core/dist/esm/server-functions-handler.js");

      if (!isTargetModule) return null;

      const needle = "const unwrapped = res.result || res.error";
      if (!code.includes(needle)) return null;

      return code.replace(
        needle,
        `${needle}

      if (res?.error) {
        const err = res.error
        const payload = {
          source: 'tanstack',
          type: 'server-fn-error',
          method: request.method,
          url: request.url,
          name: err?.name ?? 'Error',
          message: err?.message ?? String(err),
          stack: typeof err?.stack === 'string' ? err.stack : undefined,
        }
        globalThis.${HMR_SEND_KEY}?.(payload)
      }`,
      );
    },
  };
}

export default defineConfig(({ command, mode }) => {
  const sandbox = isSandboxEnvironment();

  const config: UserConfig = {
    define: viteEnvDefines(mode),
    resolve: {
      alias: {
        "@": `${projectRoot}src`,
      },
      dedupe: [
        "react",
        "react-dom",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
        "@tanstack/react-query",
        "@tanstack/query-core",
      ],
    },
    plugins: [
      tailwindcss(),
      tsConfigPaths({ projects: ["./tsconfig.json"] }),
      devServerFnErrorLogger(),
      ...(command === "build" ? cloudflare({ viteEnvironment: { name: "ssr" } }) : []),
      tanstackStart(),
      react(),
    ],
    server: {
      host: "::",
      port: 8080,
      strictPort: sandbox ? true : undefined,
      watch: sandbox
        ? undefined
        : {
            awaitWriteFinish: {
              stabilityThreshold: 1000,
              pollInterval: 100,
            },
          },
    },
  };

  return mergeConfig({}, config);
});
