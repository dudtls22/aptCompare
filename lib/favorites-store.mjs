import { hasRedis, parseRedisJsonList, redisGet, redisKeys, redisSet } from "./redis.mjs";
import {
  listLocalFavoriteClientIds,
  readLocalFavorites,
  readSharedLocalFavorites,
  writeSharedLocalFavorites
} from "./local-favorites-store.mjs";
import { mergeFavoriteLists } from "./favorites-shared.mjs";
import { setSubscriptions } from "./notify-store.mjs";

export const FAVORITES_REDIS_KEY = "apt:favorites:global";
const LEGACY_REDIS_PATTERN = "apt:favorites:*";

const UNCONFIGURED_WARNING =
  "Upstash 미설정: 로컬 파일(.data/favorites/global.json)에 저장합니다. Vercel/로컬 .env 에 UPSTASH_REDIS_REST_URL·TOKEN 을 넣으면 Redis에 동기화됩니다.";

/** @deprecated 브라우저 ID 미사용 — 전역 키만 사용 */
export function favoritesRedisKey() {
  return FAVORITES_REDIS_KEY;
}

export function normalizeFavorite(entry) {
  return {
    lawdCd: String(entry?.lawdCd ?? "").trim(),
    guName: String(entry?.guName ?? "").trim(),
    dong: String(entry?.dong ?? "").trim(),
    apt: String(entry?.apt ?? "").trim(),
    area: entry?.area != null && String(entry.area).trim() !== "" ? String(entry.area).trim() : "",
    notify: Boolean(entry?.notify)
  };
}

function normalizeList(list) {
  return (Array.isArray(list) ? list : [])
    .map(normalizeFavorite)
    .filter((f) => f.lawdCd && f.apt);
}

async function loadFromLocal() {
  const favorites = normalizeList(await readSharedLocalFavorites());
  return {
    favorites,
    storage: "local-file",
    warning: hasRedis() ? undefined : UNCONFIGURED_WARNING
  };
}

async function saveToLocal(favorites) {
  await writeSharedLocalFavorites(favorites);
  return {
    favorites,
    storage: "local-file",
    warning: hasRedis() ? undefined : UNCONFIGURED_WARNING
  };
}

async function migrateLocalLegacyIfEmpty() {
  let favorites = normalizeList(await readSharedLocalFavorites());
  if (favorites.length) {
    return favorites;
  }
  const ids = await listLocalFavoriteClientIds();
  const lists = [];
  for (const id of ids) {
    if (id === "global") continue;
    lists.push(await readLocalFavorites(id));
  }
  favorites = mergeFavoriteLists(lists, normalizeList);
  if (favorites.length) {
    await writeSharedLocalFavorites(favorites);
  }
  return favorites;
}

async function migrateRedisLegacyIfEmpty() {
  let favorites = normalizeList(parseRedisJsonList(await redisGet(FAVORITES_REDIS_KEY)));
  if (favorites.length) {
    return favorites;
  }
  const keys = await redisKeys(LEGACY_REDIS_PATTERN);
  const lists = [];
  for (const key of keys) {
    if (key === FAVORITES_REDIS_KEY) continue;
    lists.push(parseRedisJsonList(await redisGet(key)));
  }
  favorites = mergeFavoriteLists(lists, normalizeList);
  if (favorites.length) {
    await redisSet(FAVORITES_REDIS_KEY, favorites);
    await writeSharedLocalFavorites(favorites).catch(() => {});
  }
  return favorites;
}

export async function getFavorites() {
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
          await redisSet(FAVORITES_REDIS_KEY, favorites);
          return { favorites, storage: "upstash", rehydrated: true };
        } catch {
          return { favorites, storage: "local-fallback" };
        }
      }
      return { favorites: [], storage: "upstash" };
    }
    await writeSharedLocalFavorites(favorites).catch(() => {});
    return { favorites, storage: "upstash" };
  } catch (err) {
    const local = await loadFromLocal();
    return {
      ...local,
      storage: "local-fallback",
      warning: `Redis 조회 실패, 로컬 파일 사용: ${err instanceof Error ? err.message : String(err)}`
    };
  }
}

export async function setFavorites(list) {
  const favorites = normalizeList(list);

  if (!hasRedis()) {
    const saved = await saveToLocal(favorites);
    const notifyStore = await setSubscriptions(
      favorites.filter((f) => f.notify).map((f) => ({ ...f, notify: true }))
    );
    return {
      ...saved,
      count: favorites.length,
      notifyCount: favorites.filter((f) => f.notify).length,
      notifyStore
    };
  }

  try {
    await redisSet(FAVORITES_REDIS_KEY, favorites);
    await writeSharedLocalFavorites(favorites).catch(() => {});
    const notifySubs = favorites.filter((f) => f.notify);
    const notifyStore = await setSubscriptions(
      notifySubs.map((f) => ({ ...f, notify: true }))
    );
    return {
      favorites,
      storage: "upstash",
      count: favorites.length,
      notifyCount: notifySubs.length,
      notifyStore
    };
  } catch (err) {
    const saved = await saveToLocal(favorites);
    return {
      ...saved,
      storage: "local-fallback",
      count: favorites.length,
      warning: `Redis 저장 실패, 로컬 파일에 저장: ${err instanceof Error ? err.message : String(err)}`,
      notifyStore: await setSubscriptions(
        favorites.filter((f) => f.notify).map((f) => ({ ...f, notify: true }))
      )
    };
  }
}
