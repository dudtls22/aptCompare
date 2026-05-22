import { hasRedis, parseRedisJsonList, redisGet, redisKeys, redisSet } from "./redis.mjs";
import {
  listLocalGapFavoriteScopes,
  readLocalGapFavorites,
  readSharedLocalGapFavorites,
  writeSharedLocalGapFavorites
} from "./local-gap-favorites-store.mjs";
import { mergeFavoriteLists } from "./favorites-shared.mjs";

export const GAP_FAVORITES_REDIS_KEY = "apt:gap-favorites:global";
const LEGACY_GAP_REDIS_PATTERN = "apt:gap-favorites:*";

const UNCONFIGURED_WARNING =
  "Upstash 미설정: Gap 즐겨찾기는 로컬 파일(.data/gap-favorites/global.json)에 저장합니다.";

export function gapFavoritesRedisKey() {
  return GAP_FAVORITES_REDIS_KEY;
}

export function normalizeGapFavorite(entry) {
  return {
    lawdCd: String(entry?.lawdCd ?? "").trim(),
    guName: String(entry?.guName ?? "").trim(),
    dong: String(entry?.dong ?? "").trim(),
    apt: String(entry?.apt ?? "").trim(),
    area:
      entry?.area != null && String(entry.area).trim() !== ""
        ? String(entry.area).trim()
        : ""
  };
}

function normalizeList(list) {
  return (Array.isArray(list) ? list : [])
    .map(normalizeGapFavorite)
    .filter((f) => f.lawdCd && f.apt);
}

async function loadFromLocal() {
  const favorites = normalizeList(await readSharedLocalGapFavorites());
  return {
    favorites,
    storage: "local-file",
    warning: hasRedis() ? undefined : UNCONFIGURED_WARNING
  };
}

async function saveToLocal(favorites) {
  await writeSharedLocalGapFavorites(favorites);
  return {
    favorites,
    storage: "local-file",
    warning: hasRedis() ? undefined : UNCONFIGURED_WARNING
  };
}

async function migrateLocalLegacyIfEmpty() {
  let favorites = normalizeList(await readSharedLocalGapFavorites());
  if (favorites.length) {
    return favorites;
  }
  const ids = await listLocalGapFavoriteScopes();
  const lists = [];
  for (const id of ids) {
    if (id === "global") continue;
    lists.push(await readLocalGapFavorites(id));
  }
  favorites = mergeFavoriteLists(lists, normalizeList);
  if (favorites.length) {
    await writeSharedLocalGapFavorites(favorites);
  }
  return favorites;
}

async function migrateRedisLegacyIfEmpty() {
  let favorites = normalizeList(parseRedisJsonList(await redisGet(GAP_FAVORITES_REDIS_KEY)));
  if (favorites.length) {
    return favorites;
  }
  const keys = await redisKeys(LEGACY_GAP_REDIS_PATTERN);
  const lists = [];
  for (const key of keys) {
    if (key === GAP_FAVORITES_REDIS_KEY) continue;
    lists.push(parseRedisJsonList(await redisGet(key)));
  }
  favorites = mergeFavoriteLists(lists, normalizeList);
  if (favorites.length) {
    await redisSet(GAP_FAVORITES_REDIS_KEY, favorites);
    await writeSharedLocalGapFavorites(favorites).catch(() => {});
  }
  return favorites;
}

export async function getGapFavorites() {
  if (!hasRedis()) {
    const favorites = await migrateLocalLegacyIfEmpty();
    if (favorites.length) {
      return { favorites, storage: "local-file", warning: UNCONFIGURED_WARNING };
    }
    return loadFromLocal();
  }

  try {
    let favorites = await migrateRedisLegacyIfEmpty();
    if (!favorites.length) {
      favorites = await migrateLocalLegacyIfEmpty();
      if (favorites.length) {
        try {
          await redisSet(GAP_FAVORITES_REDIS_KEY, favorites);
          return { favorites, storage: "upstash", rehydrated: true };
        } catch {
          return { favorites, storage: "local-fallback" };
        }
      }
      return { favorites: [], storage: "upstash" };
    }
    await writeSharedLocalGapFavorites(favorites).catch(() => {});
    return { favorites, storage: "upstash" };
  } catch (err) {
    const local = await loadFromLocal();
    return {
      ...local,
      storage: "local-fallback",
      warning: `Redis 조회 실패, Gap 로컬 파일 사용: ${err instanceof Error ? err.message : String(err)}`
    };
  }
}

export async function setGapFavorites(list) {
  const favorites = normalizeList(list);

  if (!hasRedis()) {
    const saved = await saveToLocal(favorites);
    return { ...saved, count: favorites.length };
  }

  try {
    await redisSet(GAP_FAVORITES_REDIS_KEY, favorites);
    await writeSharedLocalGapFavorites(favorites).catch(() => {});
    return {
      favorites,
      storage: "upstash",
      count: favorites.length
    };
  } catch (err) {
    const saved = await saveToLocal(favorites);
    return {
      ...saved,
      storage: "local-fallback",
      count: favorites.length,
      warning: `Redis 저장 실패, Gap 로컬 파일에 저장: ${err instanceof Error ? err.message : String(err)}`
    };
  }
}
