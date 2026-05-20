import { hasRedis, redisGet, redisSet } from "./redis.mjs";

const NOTIFY_KEY = "apt:notify:subscriptions";

function parseJsonList(raw) {
  try {
    const parsed = JSON.parse(raw || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function getSubscriptions() {
  if (hasRedis()) {
    const raw = await redisGet(NOTIFY_KEY);
    if (raw == null) {
      return [];
    }
    return parseJsonList(raw);
  }

  return parseJsonList(process.env.NOTIFY_SUBSCRIPTIONS_JSON || "[]");
}

export async function setSubscriptions(list) {
  const normalized = Array.isArray(list) ? list : [];

  if (hasRedis()) {
    await redisSet(NOTIFY_KEY, normalized);
    return { storage: "upstash", count: normalized.length };
  }

  return {
    storage: "unconfigured",
    count: normalized.length,
    warning:
      "Upstash 미설정: 알림 목록이 Redis에 저장되지 않습니다. UPSTASH_REDIS_REST_URL·TOKEN을 설정하세요."
  };
}

export function getNotifyConfigStatus() {
  const hasKakao = Boolean((process.env.KAKAO_ACCESS_TOKEN || "").trim());
  const hasUpstash = hasRedis();
  const hasServiceKey = Boolean((process.env.DATA_GO_KR_SERVICE_KEY || "").trim());
  return { hasKakao, hasUpstash, hasServiceKey, cronScheduleKst: "09:30" };
}
