export function resolveAwardSelections({ records, awardRecords }) {
  const recordMap = new Map((records || []).map((record) => [record.id, record]));

  return (awardRecords || [])
    .map((selection) => {
      const record = recordMap.get(selection.id);
      if (!record) {
        return null;
      }

      return {
        ...record,
        display_name: selection.display_name || selection.canonical_name || record.display_name,
        chinese_name: selection.chinese_name || record.chinese_name,
        award_group: selection.award_group || null,
      };
    })
    .filter(Boolean);
}
