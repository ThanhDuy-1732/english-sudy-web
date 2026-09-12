# Huong dan deploy Firebase

Tai lieu nay ghi lai cach cau hinh va deploy ung dung Next.js `English Study` len Firebase.

## Thong tin project

- Firebase project ID: `study-project-f9e9d`
- Firebase Hosting config: `firebase.json`
- Firebase project alias: `.firebaserc`
- Firebase Web SDK config: `src/lib/firebase.ts`
- App co Next.js API routes trong `src/app/api/*`, vi vay nen deploy bang Firebase Hosting framework-aware hoac Firebase App Hosting. Khong nen export static ra `out/` neu van can cac API AI.

## Dieu kien truoc khi deploy

1. Cai dependencies:

```bash
npm install
```

2. Kiem tra file `.env.local` co du bien moi truong can thiet:

```bash
GEMINI_API_KEY=...
GROQ_API_KEY=...
HUGGINGFACE_API_KEY=...
OPENROUTER_API_KEY=...
MISTRAL_API_KEY=...
COHERE_API_KEY=...
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
```

Chi cac bien `NEXT_PUBLIC_*` moi duoc dua vao browser. Cac AI API key phai giu server-side.

3. Dang nhap Firebase CLI:

```bash
npx firebase-tools@15.24.0 login
```

Neu da tung dang nhap nhung deploy bi loi `401 UNAUTHENTICATED`, dang nhap lai:

```bash
npx firebase-tools@15.24.0 login --reauth
```

4. Bat Firebase Hosting web frameworks experiment:

```bash
npx firebase-tools@15.24.0 experiments:enable webframeworks
```

5. Dung Node.js 22 khi deploy:

```bash
nvm install 22
nvm use 22
```

Firebase framework tooling hien ho tro Node 16/18/20/22. Khong deploy bang Node 24 vi co the tao function runtime `node: "24"` va gay loi engine.

6. Bat Cloud Functions API cho project.

Vi app co Next.js API routes, Firebase Hosting se tao Cloud Function de chay backend. Bat API tai:

```text
https://console.developers.google.com/apis/api/cloudfunctions.googleapis.com/overview?project=study-project-f9e9d
```

Sau khi bat API, doi vai phut de Google Cloud propagate roi deploy lai.

7. Nang cap Firebase project len Blaze neu deploy app day du.

App nay co Next.js API routes, nen Firebase Hosting framework-aware se tao Cloud Function va can bat them `cloudbuild.googleapis.com` + `artifactregistry.googleapis.com`. Firebase yeu cau project o goi Blaze (pay-as-you-go) de bat/deploy cac thanh phan nay.

Nang cap tai:

```text
https://console.firebase.google.com/project/study-project-f9e9d/usage/details
```

Neu khong muon nang cap Blaze, chi co the deploy ban static va cac tinh nang goi `/api/*` se khong hoat dong.

## Kiem tra truoc deploy

Chay test:

```bash
npm test -- --runInBand
```

Build production:

```bash
npm run build
```

Lenh build phai hien cac route dynamic dang `ƒ /api/...`. Dieu nay xac nhan API routes van la backend dynamic, khong phai static export.

## Deploy len Firebase Hosting

Chay:

```bash
npx firebase-tools@15.24.0 deploy --only hosting --project study-project-f9e9d
```

Sau khi deploy thanh cong, Firebase CLI se in ra URL Hosting. Thu mo URL do va kiem tra:

- Trang chu load duoc.
- Navigation `/review`, `/history`, `/settings`, `/stats` hoat dong.
- Chuc nang goi AI hoat dong, vi cac route `/api/*` can backend.
- Service worker/offline page khong bao loi trong browser console.

## Xu ly loi thuong gap

### `Cannot deploy a web framework from source because the experiment webframeworks is not enabled`

Bat experiment:

```bash
npx firebase-tools@15.24.0 experiments:enable webframeworks
```

Sau do deploy lai.

### `401 UNAUTHENTICATED`

Firebase CLI token da het han hoac refresh token khong con hop le. Dang nhap lai:

```bash
npx firebase-tools@15.24.0 login --reauth
```

Sau do deploy lai.

### `Failed to list functions for study-project-f9e9d`

Chay lenh debug:

```bash
npx firebase-tools@15.24.0 functions:list --project study-project-f9e9d --debug
```

Neu log co `Cloud Functions API has not been used... or it is disabled`, bat Cloud Functions API:

```text
https://console.developers.google.com/apis/api/cloudfunctions.googleapis.com/overview?project=study-project-f9e9d
```

Sau khi bat API, doi vai phut roi deploy lai.

Neu log co `EBADENGINE` lien quan `firebase-frameworks`, chuyen sang Node 22:

```bash
nvm use 22
npx firebase-tools@15.24.0 deploy --only hosting --project study-project-f9e9d
```

### `must be on the Blaze (pay-as-you-go) plan`

Loi vi Firebase dang can bat `artifactregistry.googleapis.com` de deploy Cloud Function cho Next.js API routes, nhung project dang o Spark/free plan.

Co 2 lua chon:

1. Nang cap project len Blaze, doi vai phut, roi deploy lai:

```text
https://console.firebase.google.com/project/study-project-f9e9d/usage/details
```

```bash
nvm use 22
npx firebase-tools@15.24.0 deploy --only hosting --project study-project-f9e9d
```

2. Khong nang cap Blaze: can chuyen app sang static export. Cach nay khong phu hop neu van can cac chuc nang AI qua `/api/*`.

### `Object "/hosting" in "firebase.json" has unknown property`

Kiem tra `firebase.json`. Cau hinh hien tai nen toi thieu nhu sau:

```json
{
  "hosting": {
    "source": ".",
    "ignore": [
      "firebase.json",
      "**/.*",
      "**/node_modules/**"
    ]
  }
}
```

Khong them `frameworkBackend` vao `hosting` neu Firebase CLI bao schema khong ho tro.

### API routes khong hoat dong sau deploy

Khong dung `next export` hoac `output: "export"` cho app nay. Ung dung dang co cac route:

```text
src/app/api/generate-words/route.ts
src/app/api/generate-sentence/route.ts
src/app/api/generate-synonyms/route.ts
src/app/api/generate-fillblank/route.ts
src/app/api/generate-reading/route.ts
src/app/api/generate-batch/route.ts
src/app/api/grade-sentence/route.ts
src/app/api/providers/test/route.ts
```

Cac route nay can runtime backend.

## Ghi chu ve Firebase App Hosting

Firebase docs hien khuyen cac du an Next.js moi dung Firebase App Hosting thay cho Hosting framework-aware preview. Neu muon chuyen sang App Hosting, tao backend trong Firebase Console hoac CLI, ket noi repository GitHub, cau hinh build command `npm run build`, va cau hinh cac environment variables server-side tren App Hosting.
