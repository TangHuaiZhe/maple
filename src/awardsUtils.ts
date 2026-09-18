import type { AwardSelection, CultivarRecord } from "./types";

export function resolveAwardSelections({
  records,
  awardRecords,
}: {
  records?: CultivarRecord[];
  awardRecords?: AwardSelection[];
}): CultivarRecord[] {
  const recordMap = new Map((records || []).map((record) => [record.id, record]));

  return (awardRecords || []).reduce<CultivarRecord[]>((selected, selection) => {
      const record = recordMap.get(selection.id);
      if (!record) {
        return selected;
      }

      selected.push({
        ...record,
        display_name: selection.display_name || selection.canonical_name || record.display_name,
        chinese_name: selection.chinese_name || record.chinese_name,
        award_group: selection.award_group || null,
      });
      return selected;
    }, []);
}
