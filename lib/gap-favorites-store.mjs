import { hasRedis, redisGet, redisSet } from "./redis.mjs";
import {
  readLocalGapFavorites,
  writeLocalGapFavorites
} from "./local-gap-favorites-store.mjs";

const KEY_PREFIX = "apt:gap-favorites:";

const UNCONFIGURED_WARNING =
  "Upstash 미설정: Gap 즐겨찾기는 로컬 파일(.data/gap-favorites)에 저장합니다.";

export function gapFavoritesRedisKey(clientId) {
  const id = String(clientId || "").trim();
  if (!id) {
    throw new Error("clientId 가 필요합니다.");
  }
  return `${KEY_PREFIX}${id}`;
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

function parseJsonList(raw) {
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function normalizeList(list) {
  return (Array.isArray(list) ? list : [])
    .map(normalizeGapFavorite)
    .filter((f) => f.lawdCd && f.apt);
}

async function loadFromLocal(clientId) {
  const favorites = normalizeList(await readLocalGapFavorites(clientId));
  return {
    favorites,
    storage: "local-file",
    warning: hasRedis() ? undefined : UNCONFIGURED_WARNING
  };
}

async function saveToLocal(clientId, favorites) {
  await writeLocalGapFavorites(clientId, favorites);
  return {
    favorites,
    storage: "local-file",
    warning: hasRedis() ? undefined : UNCONFIGURED_WARNING
  };
}

export async function getGapFavorites(clientId) {
  if (!hasRedis()) {
    return loadFromLocal(clientId);
  }

  try {
    const raw = await redisGet(gapFavoritesRedisKey(clientId));
    const favorites = normalizeList(parseJsonList(raw));
    return { favorites, storage: "upstash" };
  } catch (err) {
    const local = await loadFromLocal(clientId);
    return {
      ...local,
      storage: "local-fallback",
      warning: `Redis 조회 실패, Gap 로컬 파일 사용: ${err instanceof Error ? err.message : String(err)}`
    };
  }
}

export async function setGapFavorites(clientId, list) {
  const favorites = normalizeList(list);

  if (!hasRedis()) {
    const saved = await saveToLocal(clientId, favorites);
    return {
      ...saved,
      count: favorites.length
    };
  }

  try {
    await redisSet(gapFavoritesRedisKey(clientId), favorites);
    return {
      favorites,
      storage: "upstash",
      count: favorites.length
    };
  } catch (err) {
    const saved = await saveToLocal(clientId, favorites);
    return {
      ...saved,
      storage: "local-fallback",
      count: favorites.length,
      warning: `Redis 저장 실패, Gap 로컬 파일에 저장: ${err instanceof Error ? err.message : String(err)}`
    };
  }
}
