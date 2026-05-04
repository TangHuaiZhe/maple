import test from "node:test";
import assert from "node:assert/strict";

import {
  applyPrimaryCoverSelection,
  readFavoriteIds,
  resolveAppUrl,
  resolveRecordAssetPaths,
  resolveThumbnailUrl,
  setRecordPrimaryCover,
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

test("resolveThumbnailUrl uses manifest thumbnails with app base and cache busting", () => {
  const manifest = {
    "/mrmaple-images/acer-palmatum-fireglow/01.jpg": {
      480: "/thumbs/mrmaple-images/acer-palmatum-fireglow/01-w480.webp",
    },
  };

  assert.equal(
    resolveThumbnailUrl("/maple/mrmaple-images/acer-palmatum-fireglow/01.jpg?v=source-build", manifest, 480, {
      baseUrl: "/maple/",
      cacheBust: "thumb-build",
    }),
    "/maple/thumbs/mrmaple-images/acer-palmatum-fireglow/01-w480.webp?v=thumb-build",
  );
});

test("resolveThumbnailUrl falls back to the original image when a thumbnail is not listed", () => {
  assert.equal(
    resolveThumbnailUrl("/rhs-images/a/01.jpg?v=build", {}, 480, {
      baseUrl: "/",
      cacheBust: "build",
    }),
    "/rhs-images/a/01.jpg?v=build",
  );
});

test("setRecordPrimaryCover stores normalized public image path", () => {
  const record = setRecordPrimaryCover({
    id: "acer-palmatum-kasagi-yama",
    selected_cover_path: "/old/path.jpg",
  }, "/maple/user-images/acer-palmatum-kasagi-yama/04-IMG_1309.jpg?v=build", {
    baseUrl: "/maple/",
  });

  assert.deepEqual(record, {
    id: "acer-palmatum-kasagi-yama",
    selected_cover_path: "/user-images/acer-palmatum-kasagi-yama/04-IMG_1309.jpg",
  });
});

test("applyPrimaryCoverSelection updates the current record cover immediately", () => {
  const record = applyPrimaryCoverSelection({
    id: "acer-palmatum-kasagi-yama",
    cover_path: "/user-images/acer-palmatum-kasagi-yama/01.jpg?v=build",
    images: {
      public_cover_path: "/user-images/acer-palmatum-kasagi-yama/01.jpg?v=build",
      public_paths: [
        "/user-images/acer-palmatum-kasagi-yama/01.jpg?v=build",
        "/user-images/acer-palmatum-kasagi-yama/02.jpg?v=build",
      ],
    },
  }, "/user-images/acer-palmatum-kasagi-yama/02.jpg?v=build");

  assert.deepEqual(record, {
    id: "acer-palmatum-kasagi-yama",
    cover_path: "/user-images/acer-palmatum-kasagi-yama/02.jpg?v=build",
    images: {
      public_cover_path: "/user-images/acer-palmatum-kasagi-yama/02.jpg?v=build",
      public_paths: [
        "/user-images/acer-palmatum-kasagi-yama/02.jpg?v=build",
        "/user-images/acer-palmatum-kasagi-yama/01.jpg?v=build",
      ],
    },
  });
});

test("favorite storage normalizes duplicate and blank ids", () => {
  const storage = memoryStorage(JSON.stringify(["a", "", "b", "a"]));

  assert.deepEqual(readFavoriteIds(storage), ["a", "b"]);

  writeFavoriteIds(["b", "c", "b"], storage);
  assert.equal(storage.value(), JSON.stringify(["b", "c"]));
});
