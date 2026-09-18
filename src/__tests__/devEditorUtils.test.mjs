import test from "node:test";
import assert from "node:assert/strict";

import {
  assertEditableRecordShape,
  mergeEditableRecord,
  pickEditableRecord,
} from "../devEditorUtils.ts";

test("pickEditableRecord exposes only editable cultivar fields with safe defaults", () => {
  const editable = pickEditableRecord({
    id: "acer-palmatum-sample",
    canonical_name: "Sample",
    display_name: "Sample Maple",
    images: { public_paths: ["/image.jpg"] },
  });

  assert.deepEqual(editable, {
    canonical_name: "Sample",
    display_name: "Sample Maple",
    chinese_name: "",
    scientific_name: "",
    species: "",
    top_category: "",
    web_group: "",
    selected_cover_path: "",
    book_groups: [],
    color_groups: [],
    aliases: [],
    search_terms: [],
    descriptions: {},
    descriptions_zh: {},
    sources: [],
  });
});

test("assertEditableRecordShape rejects invalid editable array fields", () => {
  assert.throws(
    () => assertEditableRecordShape({ aliases: "not an array" }),
    /aliases 必须是数组/,
  );
});

test("assertEditableRecordShape rejects invalid description objects", () => {
  assert.throws(
    () => assertEditableRecordShape({ descriptions: [] }),
    /descriptions 必须是对象/,
  );
});

test("mergeEditableRecord updates editable fields and preserves uneditable data", () => {
  const merged = mergeEditableRecord({
    id: "acer-palmatum-sample",
    display_name: "Old Name",
    images: { public_paths: ["/image.jpg"] },
  }, {
    display_name: "New Name",
    aliases: ["Alias"],
    images: null,
  });

  assert.deepEqual(merged, {
    id: "acer-palmatum-sample",
    display_name: "New Name",
    aliases: ["Alias"],
    images: { public_paths: ["/image.jpg"] },
  });
});
