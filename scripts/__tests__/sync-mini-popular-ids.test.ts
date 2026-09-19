import test from "node:test";
import assert from "node:assert/strict";

import { syncMiniPopularIds } from "../sync-mini-popular-ids";

test("syncMiniPopularIds copies public popular ids into the mini program", async () => {
  const writes = [];
  const mkdirs = [];

  const result = await syncMiniPopularIds({
    source: "public/data/popular-ids.json",
    target: "mini/src/pages/popular/popular-ids.json",
    readFile: async () => JSON.stringify(["acer-palmatum-akane", "acer-palmatum-kogane-sakae"]),
    writeFile: async (...args) => writes.push(args),
    mkdir: async (...args) => mkdirs.push(args),
  });

  assert.equal(result.count, 2);
  assert.deepEqual(mkdirs, [["mini/src/pages/popular", { recursive: true }]]);
  assert.deepEqual(writes, [[
    "mini/src/pages/popular/popular-ids.json",
    "[\n  \"acer-palmatum-akane\",\n  \"acer-palmatum-kogane-sakae\"\n]\n",
    "utf8",
  ]]);
});

test("syncMiniPopularIds rejects invalid source content", async () => {
  await assert.rejects(
    () => syncMiniPopularIds({
      readFile: async () => JSON.stringify(["acer-palmatum-akane", ""]),
      writeFile: async () => {},
      mkdir: async () => {},
    }),
    /must contain an array of non-empty string ids/,
  );
});
