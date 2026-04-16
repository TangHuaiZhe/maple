import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const execFileAsync = promisify(execFile);
const appRoot = process.cwd();
const enhancedJson = path.join(appRoot, "data-source/Resource/园艺/raw/merged-cultivars-with-rhs.json");
let saveQueue = Promise.resolve();

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";

    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 5 * 1024 * 1024) {
        reject(new Error("Request body too large"));
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

async function loadRawRecords() {
  const raw = await fs.readFile(enhancedJson, "utf8");
  return JSON.parse(raw);
}

function devRecordEditorPlugin() {
  return {
    name: "dev-record-editor",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith("/__dev/record/")) {
          next();
          return;
        }

        const url = new URL(req.url, "http://127.0.0.1");
        const id = decodeURIComponent(url.pathname.replace(/^\/__dev\/record\//, ""));

        if (!id) {
          sendJson(res, 400, { error: "Missing cultivar id" });
          return;
        }

        try {
          if (req.method === "GET") {
            const records = await loadRawRecords();
            const record = records.find((item) => item.id === id);

            if (!record) {
              sendJson(res, 404, { error: `Cultivar not found: ${id}` });
              return;
            }

            sendJson(res, 200, { record });
            return;
          }

          if (req.method === "POST") {
            const task = saveQueue.then(async () => {
              const payload = JSON.parse(await readBody(req) || "{}");
              const nextRecord = payload.record;

              if (!nextRecord || typeof nextRecord !== "object" || Array.isArray(nextRecord)) {
                throw new Error("Invalid record payload");
              }

              const records = await loadRawRecords();
              const index = records.findIndex((item) => item.id === id);

              if (index < 0) {
                throw new Error(`Cultivar not found: ${id}`);
              }

              records[index] = {
                ...nextRecord,
                id,
              };

              await fs.writeFile(enhancedJson, JSON.stringify(records, null, 2), "utf8");
              await execFileAsync(process.execPath, ["./scripts/sync-data.mjs"], { cwd: appRoot });

              return records[index];
            });

            saveQueue = task.catch(() => {});
            const record = await task;
            sendJson(res, 200, { ok: true, record });
            return;
          }

          sendJson(res, 405, { error: "Method not allowed" });
        } catch (error) {
          sendJson(res, 500, { error: error.message || "Unknown error" });
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), devRecordEditorPlugin()],
  server: {
    host: "127.0.0.1",
    port: 4173,
  },
});
