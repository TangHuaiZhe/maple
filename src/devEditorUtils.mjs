export function pickEditableRecord(record) {
  return {
    canonical_name: record.canonical_name ?? "",
    display_name: record.display_name ?? "",
    chinese_name: record.chinese_name ?? "",
    scientific_name: record.scientific_name ?? "",
    species: record.species ?? "",
    top_category: record.top_category ?? "",
    web_group: record.web_group ?? "",
    selected_cover_path: record.selected_cover_path ?? "",
    book_groups: record.book_groups || [],
    color_groups: record.color_groups || [],
    aliases: record.aliases || [],
    search_terms: record.search_terms || [],
    descriptions: record.descriptions || {},
    descriptions_zh: record.descriptions_zh || {},
    sources: record.sources || [],
  };
}

export function assertEditableRecordShape(record) {
  if (!record || typeof record !== "object" || Array.isArray(record)) {
    throw new Error("编辑内容必须是 JSON 对象");
  }

  ["book_groups", "color_groups", "aliases", "search_terms", "sources"].forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(record, key) && !Array.isArray(record[key])) {
      throw new Error(`${key} 必须是数组`);
    }
  });

  ["descriptions", "descriptions_zh"].forEach((key) => {
    if (
      Object.prototype.hasOwnProperty.call(record, key)
      && (
        !record[key]
        || typeof record[key] !== "object"
        || Array.isArray(record[key])
      )
    ) {
      throw new Error(`${key} 必须是对象`);
    }
  });
}

export function mergeEditableRecord(baseRecord, editedRecord) {
  const nextRecord = { ...baseRecord };

  [
    "canonical_name",
    "display_name",
    "chinese_name",
    "scientific_name",
    "species",
    "top_category",
    "web_group",
    "selected_cover_path",
  ].forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(editedRecord, key)) {
      nextRecord[key] = editedRecord[key];
    }
  });

  [
    "book_groups",
    "color_groups",
    "aliases",
    "search_terms",
    "sources",
    "descriptions",
    "descriptions_zh",
  ].forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(editedRecord, key)) {
      nextRecord[key] = editedRecord[key];
    }
  });

  return nextRecord;
}
