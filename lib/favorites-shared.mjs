/** 즐겨찾기 목록 항목 병합 키 */
export function favoriteEntryKey(entry) {
  return [
    String(entry?.lawdCd ?? "").trim(),
    String(entry?.dong ?? "").trim(),
    String(entry?.apt ?? "").trim(),
    String(entry?.area ?? "").trim()
  ].join("|");
}

export function mergeFavoriteLists(lists, normalizeList) {
  const map = new Map();
  for (const list of lists) {
    for (const f of normalizeList(list)) {
      map.set(favoriteEntryKey(f), f);
    }
  }
  return Array.from(map.values());
}
