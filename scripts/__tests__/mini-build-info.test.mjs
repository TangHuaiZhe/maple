import assert from "node:assert/strict";
import test from "node:test";

import { createMiniBuildInfo } from "../mini-build-info.mjs";

test("createMiniBuildInfo returns package version and git metadata", () => {
  const info = createMiniBuildInfo({
    version: "2.3.4",
    execGit: (command) => {
      if (command === "rev-parse --short=12 HEAD") return "abcdef123456";
      if (command === "rev-parse HEAD") return "abcdef1234567890";
      if (command === "log -1 --format=%cI") return "2026-05-04T10:20:30+08:00";
      if (command === "log -1 --format=%s") return "Add version page";
      throw new Error(`Unexpected command: ${command}`);
    },
    now: () => new Date("2026-05-04T02:30:00.000Z"),
  });

  assert.deepEqual(info, {
    version: "2.3.4",
    commit: "abcdef123456",
    commitFull: "abcdef1234567890",
    commitDate: "2026-05-04T10:20:30+08:00",
    commitSubject: "Add version page",
    buildTime: "2026-05-04T02:30:00.000Z",
  });
});

test("createMiniBuildInfo falls back when git metadata is unavailable", () => {
  const info = createMiniBuildInfo({
    version: "1.0.0",
    execGit: () => {
      throw new Error("git unavailable");
    },
    now: () => new Date("2026-05-04T02:30:00.000Z"),
  });

  assert.equal(info.version, "1.0.0");
  assert.equal(info.commit, "unknown");
  assert.equal(info.commitFull, "unknown");
  assert.equal(info.commitDate, "unknown");
  assert.equal(info.commitSubject, "unknown");
  assert.equal(info.buildTime, "2026-05-04T02:30:00.000Z");
});
