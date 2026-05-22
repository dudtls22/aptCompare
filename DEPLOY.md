# aptCompare 배포 가이드

## 로컬 vs Vercel vs GitHub Pages

| 환경 | 화면 | API |
|------|------|-----|
| `npm start` (로컬/VPS) | `server.mjs` | `server.mjs` (`/api/*`) |
| **Vercel** (`*.vercel.app`) | `index.html` | `api/*.js` |
| **GitHub Pages** (`*.github.io`) | `index.html`만 | **Vercel API** (`apt-compare-beta.vercel.app`) |

GitHub Pages는 정적 파일만 올라갑니다. **실거래·시세 API는 Vercel이 반드시 살아 있어야** 합니다.

---

## Vercel (GitHub 연동) — 필수 설정

**URL:** https://apt-compare-beta.vercel.app/

### 1. GitHub에 push

```powershell
cd c:\02.work\cursor_pro1
git add vercel.json package.json index.html server.mjs api/ lib/ css/ .gitignore .vercelignore DEPLOY.md
git status
git commit -m "fix: Vercel api 배포 및 GitHub Pages 연동"
git push origin main
```

### 2. Vercel 대시보드 (Settings → Build & Development)

| 항목 | 값 |
|------|-----|
| Framework Preset | **Other** |
| Root Directory | *(비움)* |
| **Build Command** | *(비움)* — `vercel.json` 의 `"buildCommand": ""` 사용 |
| **Output Directory** | *(비움)* — **`public` / `dist` 이면 `/api/*` 전부 404** |

`package.json` 에 `vercel-build` 스크립트를 두지 마세요. (과거에 `public/` 만 만들어 API가 빠졌습니다.)

저장 후 **Deployments → … → Redeploy** (캐시 없이).

### 3. 환경 변수 (Settings → Environment Variables)

| 이름 | 용도 |
|------|------|
| `DATA_GO_KR_SERVICE_KEY` | 국토부 실거래·K-apt(공동주택 기본/단지목록) API — **동일 인증키** |
| `UPSTASH_REDIS_REST_URL` | 즐겨찾기 (선택) |
| `UPSTASH_REDIS_REST_TOKEN` | 즐겨찾기 (선택) |
| `KAKAO_ACCESS_TOKEN` | 알림 (선택) |
| `CRON_SECRET` | cron 보호 (선택) |

### 4. 배포 확인

- https://apt-compare-beta.vercel.app/ → 화면
- https://apt-compare-beta.vercel.app/api/health → `{"ok":true,...}`
- https://apt-compare-beta.vercel.app/api/market → JSON

`/api/health` 가 Vercel HTML 404면 → Output Directory / Build Command 다시 확인 후 Redeploy.

`api/market.js`, `api/proxy.js`, `api/health.js` 는 Vercel에서 `lib/` import 없이 동작하도록 작성되어 있습니다 (배포 시 모듈 누락 방지).

실거래 조회가 `missing_service_key` 이면 Vercel에 **`DATA_GO_KR_SERVICE_KEY`** 환경 변수를 넣고 Redeploy 하세요.

**아파트정보 요약(세대수)** 가 `-` 로만 나오면:

1. [공공데이터포털](https://www.data.go.kr) → 마이페이지 → **오픈API 활용신청** 에서 아래가 **승인** 상태인지 확인  
   - 국토교통부_**공동주택 기본 정보제공 서비스** (V4)  
   - 국토교통부_**공동주택 단지 목록제공 서비스** (단지코드 조회용)  
2. 각 API 상세에서 **사용할 인증키**(일반/개인)가 Vercel·`.env` 의 `DATA_GO_KR_SERVICE_KEY` 와 **같은 키**로 연결돼 있는지 확인  
3. Vercel **Redeploy** 후 다시 조회  
4. 로컬 진단: `node scripts/test-apt-basis.mjs` → `Basis V4` 가 `403` 이면 아직 키 연동 미완료

---

## GitHub Pages (선택)

**URL:** https://dudtls22.github.io/aptCompare/

- 저장소 **Public**
- Settings → Pages → Source: **GitHub Actions**
- API는 위 Vercel URL을 사용 (`index.html` 의 `VERCEL_API_PROXY_BASE`)

---

## 로컬 · VPS

```powershell
npm start
```

→ http://localhost:3333/ 또는 http://서버IP:3333/

확인: `http://서버IP:3333/api/health` → `{"ok":true,...}`
