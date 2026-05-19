const REDIS_KEY = "apt:notify:subscriptions";

function parseJsonList(raw) {
  try {
    const parsed = JSON.parse(raw || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function getSubscriptions() {
  const url = (process.env.UPSTASH_REDIS_REST_URL || "").trim();
  const token = (process.env.UPSTASH_REDIS_REST_TOKEN || "").trim();

  if (url && token) {
    const res = await fetch(`${url}/get/${encodeURIComponent(REDIS_KEY)}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) {
      throw new Error(`Upstash GET failed: HTTP ${res.status}`);
    }
    const data = await res.json();
    if (data?.result == null) return [];
    return parseJsonList(data.result);
  }

  return parseJsonList(process.env.NOTIFY_SUBSCRIPTIONS_JSON || "[]");
}

export async function setSubscriptions(list) {
  const normalized = Array.isArray(list) ? list : [];
  const url = (process.env.UPSTASH_REDIS_REST_URL || "").trim();
  const token = (process.env.UPSTASH_REDIS_REST_TOKEN || "").trim();

  if (url && token) {
    const res = await fetch(`${url}/set/${encodeURIComponent(REDIS_KEY)}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(normalized)
    });
    if (!res.ok) {
      throw new Error(`Upstash SET failed: HTTP ${res.status}`);
    }
    return { storage: "upstash", count: normalized.length };
  }

  return {
    storage: "env_only",
    count: normalized.length,
    warning:
      "Upstash 미설정: 브라우저에서 동기화해도 서버에 저장되지 않습니다. UPSTASH_REDIS_REST_URL·TOKEN을 Vercel에 설정하세요."
  };
}

export function getNotifyConfigStatus() {
  const hasKakao = Boolean((process.env.KAKAO_ACCESS_TOKEN || "").trim());
  const hasUpstash = Boolean(
    (process.env.UPSTASH_REDIS_REST_URL || "").trim() &&
      (process.env.UPSTASH_REDIS_REST_TOKEN || "").trim()
  );
  const hasServiceKey = Boolean((process.env.DATA_GO_KR_SERVICE_KEY || "").trim());
  return { hasKakao, hasUpstash, hasServiceKey, cronScheduleKst: "09:30" };
}
