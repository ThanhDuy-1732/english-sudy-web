#!/usr/bin/env bash
cd "$(dirname "$0")/.."

check() {
  local label="$1"; shift
  if eval "$@" >/dev/null 2>&1; then echo "✅ $label"; else echo "❌ $label"; fi
}

echo "── S1 Sync SM-2"
check "updatedAt trong LearnedWord"           "grep -q 'updatedAt' src/lib/storage.ts"
check "sync.ts merge theo updatedAt"          "grep -q 'updatedAt\|updated_at' src/lib/sync.ts"
check "sync.ts đẩy easiness/repetitions"      "grep -q 'easiness' src/lib/sync.ts"

echo "── S2 Sync exam"
check "exam_attempts trong sync.ts"           "grep -q 'exam_attempts' src/lib/sync.ts"
check "mistake_log trong sync.ts"             "grep -q 'mistake_log' src/lib/sync.ts"
check "exam_items trong sync.ts"              "grep -q 'exam_items' src/lib/sync.ts"

echo "── S3 Scoring"
check "scoring.ts tồn tại"                    "test -f src/lib/exam/scoring.ts"
check "trang /exam/result/[attemptId]"        "test -d 'src/app/exam/result'"

echo "── S4 Speaking/Writing history"
check "speakingSessions storage"              "grep -rq 'speakingSessions' src/lib"
check "writingSubmissions storage"            "grep -rq 'writingSubmissions' src/lib"
check "BandTimelineChart"                     "test -f src/components/charts/BandTimelineChart.tsx"

echo "── S5 Mistake bridge"
check "keyVocabulary dùng ở UI"               "grep -rq 'keyVocabulary' src/components src/app/exam"
check "flag câu lỗi"                          "grep -rq 'flagged' src/lib/exam"
check "Grammar → drill RC5"                   "grep -rq 'exam/drill' src/components/Grammar*"

echo "── S6 Grading"
check "GRADING_PROVIDER trong route"          "grep -rq 'GRADING_PROVIDER' src/app/api"
check "pronunciation trả null"                "grep -q 'pronunciation' src/app/api/speech/grade/route.ts"

echo "── S7 Audio & shadowing"
check "IndexedDB cho audio"                   "grep -rq 'idb-keyval\|indexedDB' src/lib"
check "shadowing"                             "grep -rqi 'shadow' src/app src/lib"

echo "── S8 Parts"
for p in LC1 READ_P1 READ_P2 LISTEN_S2 LISTEN_S3 LISTEN_S4; do
  check "part $p" "grep -rq \"'$p'\" src/lib/exam"
done
