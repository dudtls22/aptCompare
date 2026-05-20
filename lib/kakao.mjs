export function getKakaoAccessToken() {
  let token = (process.env.KAKAO_ACCESS_TOKEN || "").trim();
  if (token.toLowerCase().startsWith("bearer ")) {
    token = token.slice(7).trim();
  }
  return token;
}

const TOKEN_HELP =
  "KAKAO_ACCESS_TOKEN 은 카카오 로그인 OAuth 로 발급한 '사용자 액세스 토큰'이어야 합니다. " +
  "REST API 키·네이티브 앱 키·만료된 토큰은 사용할 수 없습니다. " +
  "developers.kakao.com → 내 애플리케이션 → 카카오 로그인 → 동의항목에 '카카오톡 메시지 전송(talk_message)' 활성화 후 토큰을 새로 발급하세요.";

export async function validateKakaoAccessToken() {
  const token = getKakaoAccessToken();
  if (!token) {
    throw new Error(`KAKAO_ACCESS_TOKEN 이 비어 있습니다. ${TOKEN_HELP}`);
  }

  const res = await fetch("https://kapi.kakao.com/v1/user/access_token_info", {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!res.ok) {
    let detail = "";
    try {
      const errJson = await res.json();
      detail = errJson?.msg || errJson?.message || JSON.stringify(errJson);
    } catch {
      detail = await res.text();
    }
    throw new Error(
      `카카오 토큰 검증 실패 (HTTP ${res.status}): ${detail}\n${TOKEN_HELP}`
    );
  }

  return res.json();
}

export async function sendKakaoMemo(text) {
  const token = getKakaoAccessToken();
  if (!token) {
    throw new Error(`KAKAO_ACCESS_TOKEN 이 설정되지 않았습니다. ${TOKEN_HELP}`);
  }

  await validateKakaoAccessToken();

  const template = {
    object_type: "text",
    text: String(text).slice(0, 1800),
    link: {
      web_url: "https://dudtls22.github.io/aptCompare/",
      mobile_web_url: "https://dudtls22.github.io/aptCompare/"
    }
  };

  const body = new URLSearchParams({
    template_object: JSON.stringify(template)
  });

  const res = await fetch("https://kapi.kakao.com/v2/api/talk/memo/default/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/x-www-form-urlencoded;charset=utf-8"
    },
    body: body.toString()
  });

  if (!res.ok) {
    let detail = "";
    try {
      const errJson = await res.json();
      detail = errJson?.msg || errJson?.message || JSON.stringify(errJson);
    } catch {
      detail = await res.text();
    }
    const extra =
      res.status === 401
        ? `\n${TOKEN_HELP}`
        : res.status === 403
          ? "\n동의항목 '카카오톡 메시지 전송(talk_message)' 이 없거나, 토큰 발급 시 해당 scope 가 포함되지 않았을 수 있습니다."
          : "";
    throw new Error(`카카오 전송 실패 (HTTP ${res.status}): ${detail}${extra}`);
  }

  return { ok: true };
}
