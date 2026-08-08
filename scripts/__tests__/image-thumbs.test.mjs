import test from "node:test";
import assert from "node:assert/strict";

import {
  createThumbnailManifest,
  createThumbnailPublicPath,
  planThumbnailJobs,
} from "../image-thumbs.mjs";

test("createThumbnailPublicPath maps public images into width-specific webp thumbnails", () => {
  assert.equal(
    createThumbnailPublicPath("/mrmaple-images/acer-palmatum-fireglow/01.JPG", 480),
    "/thumbs/mrmaple-images/acer-palmatum-fireglow/01-w480.webp",
  );

  assert.equal(
    createThumbnailPublicPath("/user-images/acer-palmatum-kogane-sakae/cover.webp?v=20260502", 960),
    "/thumbs/user-images/acer-palmatum-kogane-sakae/cover-w960.webp",
  );
});

test("planThumbnailJobs generates jobs for referenced large images and skips existing outputs", () => {
  const jobs = planThumbnailJobs({
    imageFiles: [
      { publicPath: "/mrmaple-images/a/01.jpg", filePath: "/repo/public/mrmaple-images/a/01.jpg", size: 600_000 },
      { publicPath: "/mrmaple-images/a/02.jpg", filePath: "/repo/public/mrmaple-images/a/02.jpg", size: 600_000 },
      { publicPath: "/mrmaple-images/a/03.jpg", filePath: "/repo/public/mrmaple-images/a/03.jpg", size: 100_000 },
      { publicPath: "/mrmaple-images/unreferenced/01.jpg", filePath: "/repo/public/mrmaple-images/unreferenced/01.jpg", size: 900_000 },
    ],
    referencedPaths: new Set([
      "/mrmaple-images/a/01.jpg",
      "/mrmaple-images/a/02.jpg",
      "/mrmaple-images/a/03.jpg",
    ]),
    coverPaths: new Set(["/mrmaple-images/a/03.jpg"]),
    existingThumbPaths: new Set(["/thumbs/mrmaple-images/a/01-w480.webp"]),
    publicRoot: "/repo/public",
    sizes: [480, 960],
    minSourceBytes: 250_000,
  });

  assert.deepEqual(
    jobs.map((job) => ({
      sourcePublicPath: job.sourcePublicPath,
      thumbPublicPath: job.thumbPublicPath,
      width: job.width,
    })),
    [
      {
        sourcePublicPath: "/mrmaple-images/a/01.jpg",
        thumbPublicPath: "/thumbs/mrmaple-images/a/01-w960.webp",
        width: 960,
      },
      {
        sourcePublicPath: "/mrmaple-images/a/02.jpg",
        thumbPublicPath: "/thumbs/mrmaple-images/a/02-w480.webp",
        width: 480,
      },
      {
        sourcePublicPath: "/mrmaple-images/a/02.jpg",
        thumbPublicPath: "/thumbs/mrmaple-images/a/02-w960.webp",
        width: 960,
      },
      {
        sourcePublicPath: "/mrmaple-images/a/03.jpg",
        thumbPublicPath: "/thumbs/mrmaple-images/a/03-w480.webp",
        width: 480,
      },
      {
        sourcePublicPath: "/mrmaple-images/a/03.jpg",
        thumbPublicPath: "/thumbs/mrmaple-images/a/03-w960.webp",
        width: 960,
      },
    ],
  );
  assert.equal(jobs[0].thumbFilePath, "/repo/public/thumbs/mrmaple-images/a/01-w960.webp");
});

test("planThumbnailJobs can include every source image when requested", () => {
  const jobs = planThumbnailJobs({
    imageFiles: [
      { publicPath: "/rhs-images/a/01.jpg", filePath: "/repo/public/rhs-images/a/01.jpg", size: 100_000 },
    ],
    referencedPaths: new Set(),
    coverPaths: new Set(),
    existingThumbPaths: new Set(),
    publicRoot: "/repo/public",
    sizes: [480],
    minSourceBytes: 250_000,
    includeAll: true,
  });

  assert.deepEqual(jobs.map((job) => job.thumbPublicPath), [
    "/thumbs/rhs-images/a/01-w480.webp",
  ]);
});

test("planThumbnailJobs can restrict generation to catalog covers", () => {
  const jobs = planThumbnailJobs({
    imageFiles: [
      { publicPath: "/mrmaple-images/a/cover.jpg", filePath: "/repo/public/mrmaple-images/a/cover.jpg", size: 100_000 },
      { publicPath: "/mrmaple-images/a/detail.jpg", filePath: "/repo/public/mrmaple-images/a/detail.jpg", size: 900_000 },
    ],
    referencedPaths: new Set([
      "/mrmaple-images/a/cover.jpg",
      "/mrmaple-images/a/detail.jpg",
    ]),
    coverPaths: new Set(["/mrmaple-images/a/cover.jpg"]),
    existingThumbPaths: new Set(),
    publicRoot: "/repo/public",
    sizes: [480],
    coversOnly: true,
  });

  assert.deepEqual(jobs.map((job) => job.sourcePublicPath), [
    "/mrmaple-images/a/cover.jpg",
  ]);
});

test("planThumbnailJobs matches URL-encoded catalog paths to source files", () => {
  const jobs = planThumbnailJobs({
    imageFiles: [
      { publicPath: "/rhs-images/winter-flame/01-Web_Use-_KOT9321[1]_12300.jpg", filePath: "/repo/public/rhs-images/winter-flame/01-Web_Use-_KOT9321[1]_12300.jpg", size: 100_000 },
    ],
    referencedPaths: new Set(["/rhs-images/winter-flame/01-Web_Use-_KOT9321[1]_12300.jpg"]),
    coverPaths: new Set(["/rhs-images/winter-flame/01-Web_Use-_KOT9321%5B1%5D_12300.jpg"]),
    existingThumbPaths: new Set(),
    publicRoot: "/repo/public",
    sizes: [480],
    coversOnly: true,
  });

  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].sourcePublicPath, "/rhs-images/winter-flame/01-Web_Use-_KOT9321[1]_12300.jpg");
});

test("planThumbnailJobs prioritizes larger source images for limited batches", () => {
  const jobs = planThumbnailJobs({
    imageFiles: [
      { publicPath: "/mrmaple-images/a/small.jpg", filePath: "/repo/public/mrmaple-images/a/small.jpg", size: 300_000 },
      { publicPath: "/mrmaple-images/a/large.jpg", filePath: "/repo/public/mrmaple-images/a/large.jpg", size: 900_000 },
    ],
    referencedPaths: new Set([
      "/mrmaple-images/a/small.jpg",
      "/mrmaple-images/a/large.jpg",
    ]),
    coverPaths: new Set(),
    existingThumbPaths: new Set(),
    publicRoot: "/repo/public",
    sizes: [480],
    minSourceBytes: 250_000,
  });

  assert.deepEqual(jobs.map((job) => job.sourcePublicPath), [
    "/mrmaple-images/a/large.jpg",
    "/mrmaple-images/a/small.jpg",
  ]);
});

test("createThumbnailManifest includes only available thumbnail sizes for each source", () => {
  const manifest = createThumbnailManifest({
    imageFiles: [
      { publicPath: "/mrmaple-images/a/01.jpg" },
      { publicPath: "/mrmaple-images/a/02.jpg" },
    ],
    existingThumbPaths: new Set([
      "/thumbs/mrmaple-images/a/01-w480.webp",
    ]),
    generatedJobs: [
      {
        sourcePublicPath: "/mrmaple-images/a/02.jpg",
        thumbPublicPath: "/thumbs/mrmaple-images/a/02-w960.webp",
      },
    ],
    sizes: [480, 960],
  });

  assert.deepEqual(manifest, {
    "/mrmaple-images/a/01.jpg": {
      480: "/thumbs/mrmaple-images/a/01-w480.webp",
    },
    "/mrmaple-images/a/02.jpg": {
      960: "/thumbs/mrmaple-images/a/02-w960.webp",
    },
  });
});
