import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

test("write-web-build-info writes BUILD_INFO module with branch and commit", () => {
  execFileSync(process.execPath, ["./node_modules/tsx/dist/cli.mjs", "./scripts/write-web-build-info.ts"], {
    cwd: repoRoot,
    stdio: ["ignore", "pipe", "pipe"],
  });

  const content = readFileSync(path.join(repoRoot, "src/buildInfo.generated.ts"), "utf8");

  assert.match(content, /export const BUILD_INFO = \{/);
  assert.match(content, /"branch":\s*".+"/);
  assert.match(content, /"commit":\s*".+"/);
  assert.match(content, /"buildTime":\s*".+"/);
});
