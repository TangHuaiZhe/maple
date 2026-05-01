import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const execFileAsync = promisify(execFile);
const appRoot = process.cwd();
const enhancedJson = path.join(appRoot, "data-source/Resource/园艺/raw/merged-cultivars-with-rhs.json");
const userImagesRoot = path.join(appRoot, "data-source/Resource/园艺/raw/user-images");
let saveQueue = Promise.resolve();

function normalizeBasePath(value) {
  if (!value || value === "/") {
    return "/";
  }

  const trimmed = String(value).trim().replace(/^\/+|\/+$/g, "");
  return trimmed ? `/${trimmed}/` : "/";
}

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

function parseMultipart(body, boundary) {
  const files = [];
  const boundaryBuffer = Buffer.from(`--${boundary}`);
  const parts = [];
  let start = 0;

  while (true) {
    const idx = body.indexOf(boundaryBuffer, start);
    if (idx < 0) break;
    if (start > 0) {
      parts.push(body.slice(start, idx - 2)); // -2 for \r\n before boundary
    }
    start = idx + boundaryBuffer.length + 2; // +2 for \r\n after boundary
  }

  for (const part of parts) {
    const headerEnd = part.indexOf("\r\n\r\n");
    if (headerEnd < 0) continue;

    const headers = part.slice(0, headerEnd).toString("utf8");
    const data = part.slice(headerEnd + 4);

    const filenameMatch = headers.match(/filename="([^"]+)"/);
    if (!filenameMatch) continue;

    files.push({ filename: filenameMatch[1], data });
  }

  return files;
}

function devRecordEditorPlugin() {
  return {
    name: "dev-record-editor",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        // Image upload endpoint
        if (req.url?.startsWith("/__dev/upload-image/") && req.method === "POST") {
          const url = new URL(req.url, "http://127.0.0.1");
          const id = decodeURIComponent(url.pathname.replace(/^\/__dev\/upload-image\//, ""));

          if (!id) {
            sendJson(res, 400, { error: "Missing cultivar id" });
            return;
          }

          try {
            const chunks = [];
            let totalSize = 0;

            await new Promise((resolve, reject) => {
              req.on("data", (chunk) => {
                totalSize += chunk.length;
                if (totalSize > 20 * 1024 * 1024) {
                  reject(new Error("Upload too large (max 20MB)"));
                  return;
                }
                chunks.push(chunk);
              });
              req.on("end", resolve);
              req.on("error", reject);
            });

            const body = Buffer.concat(chunks);
            const boundary = req.headers["content-type"]?.match(/boundary=(.+)/)?.[1];

            if (!boundary) {
              sendJson(res, 400, { error: "Missing multipart boundary" });
              return;
            }

            const files = parseMultipart(body, boundary);

            if (!files.length) {
              sendJson(res, 400, { error: "No files uploaded" });
              return;
            }

            const targetDir = path.join(userImagesRoot, id);
            await fs.mkdir(targetDir, { recursive: true });

            const existing = await fs.readdir(targetDir).catch(() => []);
            let nextIndex = existing.length + 1;

            const uploadedPaths = [];

            for (const file of files) {
              const ext = path.extname(file.filename) || ".jpg";
              const baseName = path.basename(file.filename, ext).replace(/[^a-zA-Z0-9_-]/g, "_");
              const fileName = `${String(nextIndex).padStart(2, "0")}-${baseName}${ext}`;
              await fs.writeFile(path.join(targetDir, fileName), file.data);
              uploadedPaths.push(`Resource/园艺/raw/user-images/${id}/${fileName}`);
              nextIndex++;
            }

            // Update raw record
            const task = saveQueue.then(async () => {
              const records = await loadRawRecords();
              const index = records.findIndex((item) => item.id === id);

              if (index < 0) {
                throw new Error(`Cultivar not found: ${id}`);
              }

              const record = records[index];
              record.user_images = [...(record.user_images || []), ...uploadedPaths];
              records[index] = record;

              await fs.writeFile(enhancedJson, JSON.stringify(records, null, 2), "utf8");
              await execFileAsync(process.execPath, ["./scripts/sync-data.mjs"], { cwd: appRoot });

              return uploadedPaths;
            });

            saveQueue = task.catch(() => {});
            const paths = await task;
            sendJson(res, 200, { ok: true, paths });
            return;
          } catch (error) {
            sendJson(res, 500, { error: error.message || "Upload failed" });
            return;
          }
        }

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
  base: normalizeBasePath(process.env.VITE_PUBLIC_BASE),
  plugins: [react(), devRecordEditorPlugin()],
  server: {
    host: "0.0.0.0",
    port: 4173,
  },
});
