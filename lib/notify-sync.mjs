import { hasRedis, parseRedisJsonList, redisGet, redisKeys } from "./redis.mjs";
import { FAVORITES_REDIS_KEY, normalizeFavorite } from "./favorites-store.mjs";
import {
  listLocalFavoriteClientIds,
  readLocalFavorites,
  readSharedLocalFavorites
} from "./local-favorites-store.mjs";
import { getSubscriptions, setSubscriptions } from "./notify-store.mjs";

const FAVORITES_KEY_PATTERN = "apt:favorites:*";

function subscriptionKey(sub) {
  return [
    String(sub?.lawdCd || "").trim(),
    String(sub?.dong || "").trim(),
    String(sub?.apt || "").trim(),
    String(sub?.area ?? "").trim()
  ].join("|");
}

function mergeNotifyList(lists) {
  const map = new Map();
  for (const list of lists) {
    for (const entry of list) {
      const sub = normalizeFavorite({ ...entry, notify: true });
      if (!sub.lawdCd || !sub.apt) continue;
      map.set(subscriptionKey(sub), sub);
    }
  }
  return Array.from(map.values());
}

async function collectFromRedisFavorites() {
  const lists = [];
  const globalRaw = await redisGet(FAVORITES_REDIS_KEY);
  const globalNotify = parseRedisJsonList(globalRaw)
    .map(normalizeFavorite)
    .filter((f) => f.notify);
  if (globalNotify.length) {
    lists.push(globalNotify);
  }
  const keys = await redisKeys(FAVORITES_KEY_PATTERN);
  for (const key of keys) {
    if (key === FAVORITES_REDIS_KEY) continue;
    const raw = await redisGet(key);
    const favorites = parseRedisJsonList(raw)
      .map(normalizeFavorite)
      .filter((f) => f.notify);
    if (favorites.length) {
      lists.push(favorites);
    }
  }
  return mergeNotifyList(lists);
}

async function collectFromLocalFavorites() {
  const lists = [];
  const shared = (await readSharedLocalFavorites())
    .map(normalizeFavorite)
    .filter((f) => f.notify);
  if (shared.length) {
    lists.push(shared);
  }
  const clientIds = await listLocalFavoriteClientIds();
  for (const clientId of clientIds) {
    if (clientId === "global") continue;
    const raw = await readLocalFavorites(clientId);
    const favorites = (Array.isArray(raw) ? raw : [])
      .map(normalizeFavorite)
      .filter((f) => f.notify);
    if (favorites.length) {
      lists.push(favorites);
    }
  }
  return mergeNotifyList(lists);
}

/** 즐겨찾기(notify 켜짐) 전체를 알림 구독 목록에 반영 */
export async function rebuildNotifySubscriptionsFromFavorites() {
  let merged = [];

  if (hasRedis()) {
    try {
      merged = await collectFromRedisFavorites();
    } catch {
      merged = [];
    }
  }

  if (!merged.length) {
    merged = await collectFromLocalFavorites();
  }

  if (!merged.length) {
    return {
      subscriptions: await getSubscriptions(),
      storage: "existing",
      count: (await getSubscriptions()).length
    };
  }

  const store = await setSubscriptions(merged);
  return { subscriptions: merged, storage: store.storage, count: merged.length };
}

export async function getNotifySubscriptionsForCron() {
  const rebuilt = await rebuildNotifySubscriptionsFromFavorites();
  if (rebuilt.count > 0) {
    return rebuilt.subscriptions;
  }
  return (await getSubscriptions()).filter((s) => s && s.notify !== false);
}
