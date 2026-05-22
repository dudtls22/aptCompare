import { hasRedis, parseRedisJsonList, redisGet, redisSet } from "./redis.mjs";
import { readLocalFavorites, writeLocalFavorites } from "./local-favorites-store.mjs";
import { setSubscriptions } from "./notify-store.mjs";

const KEY_PREFIX = "apt:favorites:";

const UNCONFIGURED_WARNING =
  "Upstash 미설정: 로컬 파일(.data/favorites)에 저장합니다. Vercel/로컬 .env 에 UPSTASH_REDIS_REST_URL·TOKEN 을 넣으면 Redis에 동기화됩니다.";

export function favoritesRedisKey(clientId) {
  const id = String(clientId || "").trim();
  if (!id) {
    throw new Error("clientId 가 필요합니다.");
  }
  return `${KEY_PREFIX}${id}`;
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

async function loadFromLocal(clientId) {
  const favorites = normalizeList(await readLocalFavorites(clientId));
  return {
    favorites,
    storage: "local-file",
    warning: hasRedis() ? undefined : UNCONFIGURED_WARNING
  };
}

async function saveToLocal(clientId, favorites) {
  await writeLocalFavorites(clientId, favorites);
  return {
    favorites,
    storage: "local-file",
    warning: hasRedis() ? undefined : UNCONFIGURED_WARNING
  };
}

export async function getFavorites(clientId) {
  if (!hasRedis()) {
    return loadFromLocal(clientId);
  }

  try {
    const raw = await redisGet(favoritesRedisKey(clientId));
    let favorites = normalizeList(parseRedisJsonList(raw));
    if (favorites.length) {
      await writeLocalFavorites(clientId, favorites).catch(() => {});
      return { favorites, storage: "upstash" };
    }
    const local = await loadFromLocal(clientId);
    if (local.favorites.length) {
      try {
        await redisSet(favoritesRedisKey(clientId), local.favorites);
        return {
          favorites: local.favorites,
          storage: "upstash",
          rehydrated: true
        };
      } catch {
        return local;
      }
    }
    return { favorites: [], storage: "upstash" };
  } catch (err) {
    const local = await loadFromLocal(clientId);
    return {
      ...local,
      storage: "local-fallback",
      warning: `Redis 조회 실패, 로컬 파일 사용: ${err instanceof Error ? err.message : String(err)}`
    };
  }
}

export async function setFavorites(clientId, list) {
  const favorites = normalizeList(list);

  if (!hasRedis()) {
    const saved = await saveToLocal(clientId, favorites);
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
    await redisSet(favoritesRedisKey(clientId), favorites);
    await writeLocalFavorites(clientId, favorites).catch(() => {});
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
    const saved = await saveToLocal(clientId, favorites);
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
