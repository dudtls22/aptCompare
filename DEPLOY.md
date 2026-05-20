# aptCompare 배포 가이드

## 왜 Vercel에서 `/` 가 404였나?

1. Vercel은 **`public/` 안의 파일** 또는 **빌드 설정** 없이는 루트 `index.html`을 자동으로 웹에 올리지 않습니다.
2. `api/` 만 있으면 **API 전용 프로젝트**로 보고 `/` 는 404가 납니다.
3. `public/index.html` 은 **로컬에 자동 생성되지 않습니다** (`npm run sync-public` 실행 시에만 생성).
4. `serve-page` 같은 우회 API는 **Git에 push 안 되면** 배포에 포함되지 않습니다.

현재 `vercel.json` 은 `index.html` 을 **정적 파일로 명시 배포**합니다.

## Vercel (화면 + API)

**URL:** https://apt-compare-beta.vercel.app/

### Git push (프로젝트 루트에서)

```powershell
cd c:\02.work\cursor_pro1
git add vercel.json index.html css/ api/ lib/ package.json
git status
git commit -m "fix: Vercel index.html 정적 배포"
git push origin main
```

### Vercel 대시보드 (필수)

Settings → Build & Development Settings

| 항목 | 값 |
|------|-----|
| Framework Preset | **Other** |
| Root Directory | *(비움)* |
| Build Command | *(비움)* — `vercel.json` 이 처리 |
| Output Directory | *(비움)* — **`dist` 로 두면 404** |

저장 후 **Redeploy**.

### 배포 확인

- https://apt-compare-beta.vercel.app/ → 화면
- https://apt-compare-beta.vercel.app/api/health → `{"ok":true,...}`

## GitHub Pages (선택)

**URL:** https://dudtls22.github.io/aptCompare/

- 저장소 **Public**
- Settings → Pages → Source: **GitHub Actions**
- `ERR_CONNECTION_TIMED_OUT` 이면 회사망/방화벽 또는 Pages 미배포 가능

## 로컬

```powershell
npm start
```

→ http://localhost:3333/
