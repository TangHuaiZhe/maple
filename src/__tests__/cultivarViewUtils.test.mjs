import test from "node:test";
import assert from "node:assert/strict";

import {
  getAlphabetSections,
  getCoverSourceKey,
  getPreferredDescription,
  getVisibleCover,
  getVisibleImagePaths,
  isDiscoveryHiddenRecord,
  matchesQuery,
  normalizeSearchText,
  summarizeText,
} from "../cultivarViewUtils.mjs";

test("normalizeSearchText trims and lowercases user input", () => {
  assert.equal(normalizeSearchText("  BloodGood  "), "bloodgood");
});

test("isDiscoveryHiddenRecord reads the discovery_hidden flag", () => {
  assert.equal(isDiscoveryHiddenRecord({ discovery_hidden: true }), true);
  assert.equal(isDiscoveryHiddenRecord({ discovery_hidden: false }), false);
  assert.equal(isDiscoveryHiddenRecord(null), false);
});

test("getVisibleCover prefers selected visible cover and can prioritize editorial images", () => {
  const item = {
    cover_path: "/fallback.jpg",
    images: {
      public_cover_path: "/user.jpg",
      public_rhs_paths: ["/rhs.jpg"],
      public_user_paths: ["/user.jpg"],
    },
  };

  assert.deepEqual(getVisibleImagePaths(item), ["/rhs.jpg", "/user.jpg"]);
  assert.equal(getVisibleCover(item), "/user.jpg");
  assert.equal(getVisibleCover(item, { prioritizeEditorial: true }), "/rhs.jpg");
});

test("getCoverSourceKey detects image source lists", () => {
  const item = {
    images: {
      public_mrmaple_paths: ["/mr.jpg"],
      public_user_paths: ["/user.jpg"],
    },
  };

  assert.equal(getCoverSourceKey(item, "/mr.jpg"), "mrMaple");
  assert.equal(getCoverSourceKey(item, "/user.jpg"), "user");
  assert.equal(getCoverSourceKey(item, null), "none");
});

test("getPreferredDescription favors localized clean descriptions", () => {
  const zhDescription = "中文描述".repeat(50);
  const item = {
    display_name: "Bloodgood",
    descriptions: { preferred: `${zhDescription}NURSERY SOURCES should be removed.` },
    descriptions_en: { preferred: "English localized description." },
  };

  assert.equal(getPreferredDescription(item, "zh"), zhDescription);
  assert.equal(getPreferredDescription(item, "en"), "English localized description.");
});

test("summarizeText returns localized empty text and trims long descriptions", () => {
  assert.equal(summarizeText("", "zh"), "暂无简介");
  assert.equal(summarizeText("", "en"), "No summary available.");
  assert.equal(summarizeText("第一句很短。第二句也很短。第三句会被截断。", "zh", 8), "第一句很短。...");
});

test("getAlphabetSections sorts records and matches search index text", () => {
  const records = [
    { id: "b", display_name: "Bloodgood", chinese_name: "血红", search_index: "bloodgood\n血红" },
    { id: "a", display_name: "Akane", chinese_name: "茜", search_index: "akane\n茜" },
  ];

  assert.equal(matchesQuery(records[0], "blood"), true);
  assert.equal(matchesQuery(records[0], "akane"), false);
  assert.deepEqual(getAlphabetSections(records).map(([letter, items]) => [letter, items.map((item) => item.id)]), [
    ["A", ["a"]],
    ["B", ["b"]],
  ]);
});
