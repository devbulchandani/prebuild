import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { spawn, execFile } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

/*
 * Local CLI bridge — lets the browser app use locally installed coding
 * agents (opencode, claude) as AI engines. Dev server only.
 *   GET  /api/cli-check            → { opencode: bool, claude: bool }
 *   POST /api/cli-agent            → { agent, prompt } ⇒ { ok, text?, error? }
 *   POST /api/upload-image         → { dataUrl } ⇒ { ok, path }  (temp file for CLI vision)
 */

function readBody(req: import("http").IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => resolve(data));
    req.on("error", () => resolve(""));
  });
}

function json(res: import("http").ServerResponse, payload: unknown, code = 200) {
  res.statusCode = code;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
}

function cliBridgePlugin(): Plugin {
  const have = (cmd: string) =>
    new Promise<boolean>((resolve) => {
      execFile("which", [cmd], (err) => resolve(!err));
    });

  const AGENTS: Record<string, { cmd: string; args: (p: string) => string[] }> = {
    opencode: { cmd: "opencode", args: (p) => ["run", p] },
    claude: { cmd: "claude", args: (p) => ["-p", p, "--output-format", "text"] },
  };

  return {
    name: "prebuild-cli-bridge",
    configureServer(server) {
      server.middlewares.use("/api/cli-check", (_req, res) => {
        Promise.all([have("opencode"), have("claude")]).then(([opencode, claude]) =>
          json(res, { opencode, claude }),
        );
      });

      server.middlewares.use("/api/cli-agent", (req, res) => {
        if (req.method !== "POST") return json(res, { ok: false, error: "POST only" }, 405);
        readBody(req).then(async (raw) => {
          let body: { agent?: string; prompt?: string };
          try {
            body = JSON.parse(raw || "{}");
          } catch {
            return json(res, { ok: false, error: "Bad JSON body" }, 400);
          }
          const spec = body.agent ? AGENTS[body.agent] : undefined;
          if (!spec || !body.prompt) return json(res, { ok: false, error: "Unknown agent" }, 400);

          const installed = await have(spec.cmd);
          if (!installed)
            return json(res, { ok: false, error: `${spec.cmd} is not installed or not on PATH` }, 404);

          const child = spawn(spec.cmd, spec.args(body.prompt), { stdio: ["ignore", "pipe", "pipe"] });
          let out = "";
          let err = "";
          const timer = setTimeout(() => child.kill("SIGKILL"), 300_000);
          child.stdout.on("data", (d) => (out += d));
          child.stderr.on("data", (d) => (err += d));
          child.on("error", (e) => {
            clearTimeout(timer);
            json(res, { ok: false, error: String(e) }, 500);
          });
          child.on("close", (code) => {
            clearTimeout(timer);
            if (code === 0) json(res, { ok: true, text: out });
            else json(res, { ok: false, error: err.trim().slice(0, 500) || `${spec.cmd} exited ${code}` }, 500);
          });
        });
      });

      server.middlewares.use("/api/upload-image", (req, res) => {
        if (req.method !== "POST") return json(res, { ok: false, error: "POST only" }, 405);
        readBody(req).then(async (raw) => {
          try {
            const { dataUrl } = JSON.parse(raw || "{}");
            const m = String(dataUrl || "").match(/^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/);
            if (!m) return json(res, { ok: false, error: "Unsupported image" }, 400);
            const ext = m[1] === "jpeg" ? "jpg" : m[1];
            const file = path.join(tmpdir(), `prebuild-plan-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`);
            await writeFile(file, Buffer.from(m[2], "base64"));
            json(res, { ok: true, path: file });
          } catch (e) {
            json(res, { ok: false, error: String(e) }, 500);
          }
        });
      });

      server.middlewares.use("/api/nvidia", (req, res) => {
        if (req.method !== "POST") return json(res, { ok: false, error: "POST only" }, 405);
        readBody(req).then(async (raw) => {
          try {
            const body = JSON.parse(raw || "{}");
            const apiKey = body.key || process.env.VITE_NVIDIA_API_KEY;
            if (!apiKey) return json(res, { ok: false, error: "No NVIDIA API key provided" }, 400);

            const { key: _key, ...payload } = body;

            const https = await import("node:https");
            const postData = JSON.stringify(payload);
            const proxyReq = https.request(
              "https://integrate.api.nvidia.com/v1/chat/completions",
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${apiKey}`,
                  "Content-Length": Buffer.byteLength(postData),
                },
              },
              (proxyRes) => {
                let data = "";
                proxyRes.on("data", (chunk: Buffer) => (data += chunk));
                proxyRes.on("end", () => {
                  res.statusCode = proxyRes.statusCode ?? 500;
                  res.setHeader("Content-Type", "application/json");
                  res.end(data);
                });
              },
            );
            proxyReq.on("error", (e) => json(res, { error: String(e) }, 502));
            proxyReq.write(postData);
            proxyReq.end();
          } catch (e) {
            json(res, { error: String(e) }, 500);
          }
        });
      });

      // eslint-disable-next-line no-console
      console.log("[prebuild] CLI bridge ready: opencode + claude + nvidia-proxy");
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), cliBridgePlugin()],
});
