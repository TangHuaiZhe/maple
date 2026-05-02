import test from "node:test";
import assert from "node:assert/strict";

import {
  collectReferencedImagePaths,
  createImageAuditReport,
  summarizeImageFiles,
} from "../image-audit.mjs";

test("collectReferencedImagePaths gathers public image paths from catalog and detail records", () => {
  const refs = collectReferencedImagePaths([
    {
      id: "acer-palmatum-a",
      cover_path: "/mrmaple-images/a/01.jpg",
      images: {
        public_cover_path: "/mrmaple-images/a/01.jpg",
        public_user_paths: ["/user-images/a/02.jpg"],
      },
    },
    {
      id: "acer-palmatum-b",
      images: {
        public_paths: ["/rhs-images/b/01.jpg", "/rhs-images/b/01.jpg"],
      },
    },
  ]);

  assert.deepEqual([...refs].sort(), [
    "/mrmaple-images/a/01.jpg",
    "/rhs-images/b/01.jpg",
    "/user-images/a/02.jpg",
  ]);
});

test("summarizeImageFiles groups images by top-level public directory", () => {
  const summary = summarizeImageFiles([
    { publicPath: "/mrmaple-images/a/01.jpg", size: 1_000 },
    { publicPath: "/mrmaple-images/a/02.jpg", size: 3_000 },
    { publicPath: "/user-images/b/01.jpg", size: 2_000 },
  ]);

  assert.deepEqual(summary.directories, [
    { directory: "mrmaple-images", files: 2, bytes: 4_000 },
    { directory: "user-images", files: 1, bytes: 2_000 },
  ]);
  assert.deepEqual(summary.total, { files: 3, bytes: 6_000 });
});

test("createImageAuditReport flags oversized and unreferenced images", () => {
  const report = createImageAuditReport({
    imageFiles: [
      { publicPath: "/mrmaple-images/a/01.jpg", size: 1_000 },
      { publicPath: "/mrmaple-images/a/02.jpg", size: 9_000 },
      { publicPath: "/user-images/b/01.jpg", size: 2_000 },
    ],
    referencedPaths: new Set([
      "/mrmaple-images/a/01.jpg",
      "/user-images/b/01.jpg",
    ]),
    oversizedThresholdBytes: 5_000,
    limit: 10,
  });

  assert.deepEqual(report.oversizedFiles, [
    { publicPath: "/mrmaple-images/a/02.jpg", size: 9_000 },
  ]);
  assert.deepEqual(report.unreferencedFiles, [
    { publicPath: "/mrmaple-images/a/02.jpg", size: 9_000 },
  ]);
});
