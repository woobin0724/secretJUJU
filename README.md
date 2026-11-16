# 멋진 신세계 입국심사

독서멘토링 모둠 '시크릿쥬쥬'의 『멋진 신세계』 발표용 체험형 웹입니다.
청중이 휴대폰으로 QR을 찍고 들어와 '세계국가 입국심사'를 받고, 그 결과가 발표 화면에 실시간으로 집계됩니다.

| 주소 | 용도 |
|---|---|
| `/#/` | 청중용 휴대폰 화면 |
| `/#/screen` | 프로젝터용 발표 화면 (`F` = 전체화면) |
| `/#/admin` | 진행자 제어 (휴대폰에서 사용) |
| `/#/solo` | 발표가 끝난 뒤 혼자 해보기 (서버에 아무것도 저장하지 않음) |
| 아무 주소 + `?demo=1` | 데모 모드 (Firebase 없이 동작) |

이 앱은 일부러 '반(反)소마'로 만들었습니다. 무한 스크롤·추천·알림·좋아요·공유·소리가 없고, 답을 고른 뒤에는 넘길 수 없는 10초짜리 '섬' 화면이 있습니다.

---

## 1. 5분 시작하기

Node.js 20 이상이 필요합니다.

```bash
npm install
```

```bash
npm run dev
```

브라우저에서 아래 두 주소를 **두 탭으로** 엽니다. Firebase 설정이 없어도 됩니다.

- `http://localhost:5173/brave-new-world/#/?demo=1` (청중 화면. 창을 휴대폰 크기로 줄이면 좋습니다)
- `http://localhost:5173/brave-new-world/#/screen?demo=1` (발표 화면)

> 지시서의 `http://localhost:5173/#/?demo=1` 로 들어가도 Vite 가 위 주소를 안내합니다. 하위 경로 없이 쓰려면 `.env.local` 에 `VITE_BASE=/` 를 넣습니다.

데모 모드 키보드(어느 탭에서든): `→` 다음 단계, `←` 이전 단계, `R` 초기화. 두 탭은 함께 움직이고, 가짜 청중 48명의 응답이 서서히 쌓입니다.

## 2. Firebase 설정

1. [Firebase 콘솔](https://console.firebase.google.com)에서 **프로젝트를 만듭니다**(Google 애널리틱스는 꺼도 됩니다).
2. **빌드 > Realtime Database > 데이터베이스 만들기**. 위치는 `asia-southeast1`(싱가포르), 잠금 모드로 시작합니다.
3. **빌드 > Authentication > 로그인 방법**에서 **익명**과 **이메일/비밀번호**를 켭니다.
4. **Authentication > 사용자 > 사용자 추가**로 **진행자 계정**(이메일·비밀번호)을 만듭니다. QR을 공개하기 전에 반드시 먼저 만들어 둡니다.
5. **프로젝트 설정 > 내 앱 > 웹 앱 추가(`</>`)** 후 나오는 설정값을 `.env.local` 에 넣습니다.

   ```bash
   cp .env.example .env.local
   ```

   | `.env.local` 변수 | Firebase 설정 키 |
   |---|---|
   | `VITE_FIREBASE_API_KEY` | `apiKey` |
   | `VITE_FIREBASE_AUTH_DOMAIN` | `authDomain` |
   | `VITE_FIREBASE_DATABASE_URL` | `databaseURL` (`https://...asia-southeast1.firebasedatabase.app`) |
   | `VITE_FIREBASE_PROJECT_ID` | `projectId` |
   | `VITE_FIREBASE_APP_ID` | `appId` |
   | `VITE_ADMIN_EMAIL` | 4번에서 만든 진행자 이메일 |

6. **`database.rules.json` 의 진행자 이메일을 바꿉니다.** 파일 안에 `admin@example.com` 이 **세 군데** 있습니다. 세 곳 모두 4번의 진행자 이메일(소문자)로 바꿉니다. 바꾸지 않으면 진행자가 단계를 넘길 수 없습니다.
7. 규칙을 배포합니다. 둘 중 한 가지 방법을 씁니다.
   - 콘솔: **Realtime Database > 규칙** 탭에 `database.rules.json` 내용을 그대로 붙여 넣고 **게시**.
   - CLI:

     ```bash
     npx firebase login
     ```

     ```bash
     npx firebase deploy --only database --project <프로젝트 ID>
     ```

8. **Authentication > 설정 > 승인된 도메인**에 `woobin0724.github.io` 를 추가합니다.

설정이 비어 있으면 앱은 죽지 않고 "데모 모드로 실행하려면 주소 끝에 ?demo=1" 안내를 보여 줍니다.

## 3. GitHub Pages 배포

1. GitHub 계정 `woobin0724` 에 `brave-new-world` 저장소를 만들고 이 코드를 `main` 브랜치로 올립니다. (저장소 이름이 다르면 워크플로가 그 이름을 하위 경로로 자동 사용합니다.)
2. **Settings > Secrets and variables > Actions > New repository secret** 으로 `.env.local` 과 같은 이름·값 6개를 등록합니다: `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_DATABASE_URL`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID`, `VITE_ADMIN_EMAIL`.
3. **Settings > Pages > Build and deployment > Source** 를 **GitHub Actions** 로 바꿉니다.
4. `main` 에 푸시하면 `.github/workflows/deploy.yml` 이 린트·테스트·빌드 후 자동 배포합니다.
5. 주소: `https://woobin0724.github.io/brave-new-world/` (발표 화면은 끝에 `#/screen`, 진행자는 `#/admin`).

## 4. 발표 당일 체크리스트

**리허설 (발표 전)**

1. 진행자 휴대폰에서 `#/admin` 로그인.
2. 발표용 컴퓨터에서 `#/screen` 을 열고 `F` 로 전체화면.
3. 휴대폰 3대 이상(갤럭시·아이폰 섞어서)으로 QR 접속 테스트. 발표 화면 오른쪽 위 '접속 n명'이 늘어나는지 확인.
4. 전 단계 진행: 1라운드 열기 → 닫기 → 재심사 열기 → 종료.
5. **[전체 초기화]** (확인 → `INIT` 입력). 발표 화면이 QR 대기 화면, 응답 0명으로 돌아왔는지 확인.

**발표 순서**

1. 대기(QR 화면) — 청중이 QR을 찍고 들어옵니다.
2. **[1라운드 열기]** — 청중이 네 문항에 답하고, 발표 화면에 막대가 쌓입니다.
3. (발표 진행)
4. **[1라운드 닫기]** — "버튼을 누른다 n%" 가 크게 나옵니다.
5. (발표 마지막) **[재심사 열기]** — Q4 를 다시 묻습니다.
6. **[종료]** — 처음과 지금 비교 화면.

**와이파이가 안 될 때**: 미리 녹화해 둔 백업 영상(5장)을 PPT 에서 재생합니다. 인터넷이 전혀 없어도 됩니다.

## 5. 백업 영상 녹화 방법

1. 크롬에서 `…/#/screen?demo=1` 을 열고 `F` 로 전체화면.
2. 새 창으로 `…/#/?demo=1` 을 열고 휴대폰 크기(약 390×844)로 줄여 발표 화면 위 한쪽에 나란히 놓습니다. (같은 브라우저여야 두 창이 함께 움직입니다.)
3. 화면 녹화를 시작합니다(Windows: `Win+Alt+R`, macOS: `Shift+Cmd+5`).
4. 발표 화면 창을 클릭하고 `R` 로 초기화한 뒤 `→` 로 1라운드를 엽니다.
5. 휴대폰 크기 창에서 직접 답합니다(섬 10초, 계급 판정, 입국 승인까지). 그동안 가짜 청중의 막대가 쌓입니다.
6. 발표 화면에서 `→`(1라운드 닫기) → `→`(재심사 열기) → 휴대폰 창에서 재심사에 답함 → `→`(종료).
7. 녹화를 멈추고 PPT 에 넣습니다. 구석에 작게 `DEMO` 표시가 보입니다.

데모의 가짜 청중은 48명이고, 전원이 답하면 1라운드 '누른다' 30명(63%로 표시), 재심사 20명(42%로 표시)입니다. 직접 답한 창이 있으면 49명 기준으로 1%p 안팎 달라집니다.

## 6. 문구·설정 바꾸는 곳

- **문구 전체**: `src/content.ts` (질문, 섬 질문 표, 버튼, 발표·진행자 화면 문구)
- **설정**: `src/config.ts` (섬 길이 10초, 어느 문항 뒤에 섬을 넣을지 `ISLAND_AFTER`, 계급 색, 데모 청중 수와 목표 비율, 장면별 배경 파일)
- **배경 영상·사진**: `public/media/` 에 같은 이름으로 넣습니다. `.mp4` 만 넣으면 `npm run dev`/`build` 때 ffmpeg 가 있으면 첫 프레임으로 `.jpg` 를 만듭니다. 파일이 없으면 jpg → 단색 순서로 대체됩니다.
- **색·글꼴**: `src/styles.css` 맨 위의 변수.

## 검증 명령

```bash
npm run lint
```

```bash
npm test
```

```bash
npm run build
```

```bash
npm run e2e
```

```bash
npm run test:rules
```

- `npm run e2e`: Playwright 로 데모 모드 전체 흐름을 돌리고 각 단계 스크린샷을 `qa/` 에 저장합니다(처음 한 번 `npx playwright install chromium` 필요).
- `npm run test:rules`: Firebase 에뮬레이터에서 보안 규칙을 검사합니다(Java 필요).

판단이 필요했던 부분은 `DECISIONS.md` 에 적어 두었습니다.
