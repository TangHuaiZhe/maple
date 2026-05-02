import test from "node:test";
import assert from "node:assert/strict";

import {
  checkCatalogDetailConsistency,
  checkImagePathsExist,
} from "../check-data.mjs";

test("checkCatalogDetailConsistency reports catalog ids without detail files", () => {
  const result = checkCatalogDetailConsistency({
    catalogRecords: [
      { id: "acer-palmatum-existing", display_name: "Existing" },
      { id: "acer-palmatum-missing", display_name: "Missing" },
    ],
    detailRecordsById: new Map([
      ["acer-palmatum-existing", { id: "acer-palmatum-existing", display_name: "Existing" }],
    ]),
    mergedRecords: [
      { id: "acer-palmatum-existing", display_name: "Existing" },
      { id: "acer-palmatum-missing", display_name: "Missing" },
    ],
  });

  assert.deepEqual(result.errors, [
    "catalog id acer-palmatum-missing is missing public/data/details/acer-palmatum-missing.json",
  ]);
});

test("checkCatalogDetailConsistency reports details that diverge from catalog and merged records", () => {
  const result = checkCatalogDetailConsistency({
    catalogRecords: [
      { id: "acer-palmatum-sample", display_name: "Catalog Name", chinese_name: "目录名" },
    ],
    detailRecordsById: new Map([
      ["acer-palmatum-sample", { id: "acer-palmatum-sample", display_name: "Detail Name", chinese_name: "详情名" }],
    ]),
    mergedRecords: [
      { id: "acer-palmatum-sample", display_name: "Merged Name", chinese_name: "合并名" },
    ],
  });

  assert.deepEqual(result.errors, [
    "acer-palmatum-sample display_name mismatch: catalog=\"Catalog Name\" detail=\"Detail Name\" merged=\"Merged Name\"",
    "acer-palmatum-sample chinese_name mismatch: catalog=\"目录名\" detail=\"详情名\" merged=\"合并名\"",
  ]);
});

test("checkImagePathsExist reports public image paths that are missing on disk", () => {
  const result = checkImagePathsExist({
    records: [
      {
        id: "acer-palmatum-kogane-sakae",
        images: {
          public_cover_path: "/user-images/acer-palmatum-kogane-sakae/01-kogane.webp",
          public_user_paths: [
            "/user-images/acer-palmatum-kogane-sakae/01-kogane.webp",
            "/user-images/acer-palmatum-kogane-sakae/missing.jpg",
          ],
        },
      },
    ],
    publicPathExists: (publicPath) => publicPath.endsWith("01-kogane.webp"),
  });

  assert.deepEqual(result.errors, [
    "acer-palmatum-kogane-sakae references missing image /user-images/acer-palmatum-kogane-sakae/missing.jpg",
  ]);
});
