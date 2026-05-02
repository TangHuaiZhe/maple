import test from "node:test";
import assert from "node:assert/strict";

import {
  readFavoriteIds,
  resolveAppUrl,
  resolveRecordAssetPaths,
  writeFavoriteIds,
} from "../dataUtils.mjs";

function memoryStorage(initialValue = null) {
  let value = initialValue;
  return {
    getItem() {
      return value;
    },
    setItem(_key, nextValue) {
      value = nextValue;
    },
    value() {
      return value;
    },
  };
}

test("resolveAppUrl appends cache busting to user image paths", () => {
  assert.equal(
    resolveAppUrl("/user-images/acer-palmatum-kogane-sakae/01-kogane.webp", {
      baseUrl: "/",
      cacheBust: "test-build",
    }),
    "/user-images/acer-palmatum-kogane-sakae/01-kogane.webp?v=test-build",
  );
});

test("resolveRecordAssetPaths resolves public_user_paths", () => {
  const record = resolveRecordAssetPaths({
    id: "acer-palmatum-kogane-sakae",
    images: {
      public_user_paths: ["/user-images/acer-palmatum-kogane-sakae/01-kogane.webp"],
    },
  }, {
    baseUrl: "/maple/",
    cacheBust: "test-build",
  });

  assert.deepEqual(record.images.public_user_paths, [
    "/maple/user-images/acer-palmatum-kogane-sakae/01-kogane.webp?v=test-build",
  ]);
});

test("favorite storage normalizes duplicate and blank ids", () => {
  const storage = memoryStorage(JSON.stringify(["a", "", "b", "a"]));

  assert.deepEqual(readFavoriteIds(storage), ["a", "b"]);

  writeFavoriteIds(["b", "c", "b"], storage);
  assert.equal(storage.value(), JSON.stringify(["b", "c"]));
});
