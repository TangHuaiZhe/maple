import test from "node:test";
import assert from "node:assert/strict";

import {
  getCompressedImageFileName,
  shouldAttemptImageCompression,
} from "../imageUpload.mjs";

test("shouldAttemptImageCompression only selects compressible image types", () => {
  assert.equal(shouldAttemptImageCompression({ type: "image/jpeg", size: 500_000 }), true);
  assert.equal(shouldAttemptImageCompression({ type: "image/png", size: 500_000 }), true);
  assert.equal(shouldAttemptImageCompression({ type: "image/webp", size: 500_000 }), true);
  assert.equal(shouldAttemptImageCompression({ type: "image/gif", size: 500_000 }), false);
  assert.equal(shouldAttemptImageCompression({ type: "application/pdf", size: 500_000 }), false);
});

test("getCompressedImageFileName keeps the original base name and uses jpg", () => {
  assert.equal(getCompressedImageFileName("Osakazuki fall.PNG"), "Osakazuki fall.jpg");
  assert.equal(getCompressedImageFileName("image"), "image.jpg");
});
