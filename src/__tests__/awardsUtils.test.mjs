import test from "node:test";
import assert from "node:assert/strict";

import { resolveAwardSelections } from "../awardsUtils.mjs";

test("resolveAwardSelections overlays award data onto matching catalog records", () => {
  const records = [
    {
      id: "acer-palmatum-bloodgood",
      display_name: "Catalog Bloodgood",
      chinese_name: "目录血红",
      cover_path: "/cover.jpg",
    },
  ];
  const awardRecords = [
    {
      id: "acer-palmatum-bloodgood",
      display_name: "Award Bloodgood",
      chinese_name: "获奖血红",
      award_group: "山红叶",
    },
    {
      id: "missing",
      display_name: "Missing",
    },
  ];

  assert.deepEqual(resolveAwardSelections({ records, awardRecords }), [
    {
      id: "acer-palmatum-bloodgood",
      display_name: "Award Bloodgood",
      chinese_name: "获奖血红",
      cover_path: "/cover.jpg",
      award_group: "山红叶",
    },
  ]);
});

test("resolveAwardSelections falls back to catalog names when award names are blank", () => {
  const records = [
    {
      id: "acer-palmatum-akane",
      display_name: "Akane",
      chinese_name: "茜",
    },
  ];
  const awardRecords = [
    {
      id: "acer-palmatum-akane",
      display_name: "",
      canonical_name: "",
      chinese_name: "",
    },
  ];

  assert.deepEqual(resolveAwardSelections({ records, awardRecords }), [
    {
      id: "acer-palmatum-akane",
      display_name: "Akane",
      chinese_name: "茜",
      award_group: null,
    },
  ]);
});
