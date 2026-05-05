import assert from "node:assert/strict";
import test from "node:test";

import { createBuildInfo, createWebBuildInfoModule } from "../build-info.mjs";

test("createBuildInfo reads version from latest git tag", () => {
  const info = createBuildInfo({
    version: "1.0.4",
    execGit: (command) => {
      if (command === "describe --tags --abbrev=0") return "1.0.4";
      if (command === "rev-parse --abbrev-ref HEAD") return "codex/version-info";
      if (command === "rev-parse --short=12 HEAD") return "abcdef123456";
      if (command === "rev-parse HEAD") return "abcdef1234567890";
      if (command === "log -1 --format=%cI") return "2026-05-04T10:20:30+08:00";
      if (command === "log -1 --format=%s") return "Show build info";
      throw new Error(`Unexpected command: ${command}`);
    },
    now: () => new Date("2026-05-04T02:30:00.000Z"),
  });

  assert.deepEqual(info, {
    version: "1.0.4",
    branch: "codex/version-info",
    commit: "abcdef123456",
    commitFull: "abcdef1234567890",
    commitDate: "2026-05-04T10:20:30+08:00",
    commitSubject: "Show build info",
    buildTime: "2026-05-04T02:30:00.000Z",
  });
});

test("createBuildInfo falls back to package version when no git tag exists", () => {
  const info = createBuildInfo({
    execGit: (command) => {
      if (command === "describe --tags --abbrev=0") throw new Error("no tag");
      throw new Error("git unavailable");
    },
    now: () => new Date("2026-05-04T02:30:00.000Z"),
  });

  assert.equal(info.version, "1.0.0");
  assert.equal(info.branch, "unknown");
  assert.equal(info.commit, "unknown");
  assert.equal(info.commitFull, "unknown");
  assert.equal(info.commitDate, "unknown");
  assert.equal(info.commitSubject, "unknown");
  assert.equal(info.buildTime, "2026-05-04T02:30:00.000Z");
});

test("createWebBuildInfoModule serializes build info as an ES module", () => {
  assert.equal(
    createWebBuildInfoModule({
      version: "1.0.0",
      branch: "main",
      commit: "abc123",
      commitFull: "abc123456",
      commitDate: "2026-05-04T10:20:30+08:00",
      commitSubject: "Show build info",
      buildTime: "2026-05-04T02:30:00.000Z",
    }),
    `export const BUILD_INFO = {
  "version": "1.0.0",
  "branch": "main",
  "commit": "abc123",
  "commitFull": "abc123456",
  "commitDate": "2026-05-04T10:20:30+08:00",
  "commitSubject": "Show build info",
  "buildTime": "2026-05-04T02:30:00.000Z"
};
`,
  );
});
