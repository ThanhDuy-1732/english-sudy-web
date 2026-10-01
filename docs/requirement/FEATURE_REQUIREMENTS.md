# English Study App — Feature Requirements

> Tài liệu requirement dành cho Codex / Claude Code triển khai các feature mở rộng.
>
> **Source context:** `APP_OVERVIEW.md`
>
> **Mục đích:** Tách riêng yêu cầu phát triển tương lai khỏi tài liệu mô tả kiến trúc và trạng thái hiện tại của ứng dụng.
>
> **Nguyên tắc sử dụng:** AI coding agent phải đọc `APP_OVERVIEW.md` trước, sau đó đọc tài liệu này trước khi bắt đầu implement.

---

# 1. Product Goal

Phát triển ứng dụng từ một tập hợp các module học tiếng Anh độc lập thành một **adaptive learning system** có khả năng:

- Theo dõi toàn bộ hoạt động học tập của người dùng.
- Xác định điểm mạnh, điểm yếu theo từng kỹ năng và chủ đề.
- Ghi nhận lỗi sai xuyên suốt Vocabulary, Grammar, Exam, Speaking và Writing.
- Tự động xây dựng kế hoạch học mỗi ngày dựa trên dữ liệu thực tế.
- Điều chỉnh độ khó và nội dung luyện tập theo tiến trình cá nhân.
- Theo dõi tiến bộ dài hạn.
- Hoạt động tốt khi offline và đồng bộ lại khi có mạng.
- Duy trì kiến trúc AI multi-provider hiện tại nhưng bổ sung task routing và observability.

---

# 2. Existing System Constraints

Các requirement trong tài liệu này phải tương thích với kiến trúc hiện tại.

## 2.1 Core stack

- Next.js 14 App Router.
- TypeScript.
- Tailwind CSS.
- `localStorage` hiện là primary storage.
- Supabase dùng để sync.
- Firebase Hosting.
- Jest + `@testing-library/react`.
- PWA qua `public/sw.js`.

## 2.2 AI architecture

- AI calls chỉ được thực hiện server-side.
- Client không được import trực tiếp `src/lib/providers/`.
- API keys không được expose sang browser.
- Phải tiếp tục sử dụng provider fallback architecture hiện tại.
- Feature mới không được hard-code một provider duy nhất nếu không có lý do kỹ thuật rõ ràng.

## 2.3 Backward compatibility

Feature mới phải:

- Không làm mất dữ liệu hiện có trong `localStorage`.
- Không yêu cầu user reset app.
- Có migration khi thay đổi data model.
- Xử lý được dữ liệu cũ thiếu field mới.
- Không phá vỡ Supabase sync hiện tại trước khi Sync v2 được triển khai.

## 2.4 Dependency policy

Không thêm dependency mới nếu:

- Browser API đã đáp ứng được yêu cầu.
- Existing dependency đã làm được việc tương tự.
- Dependency chỉ phục vụ một use case nhỏ.

Mọi dependency mới phải được ghi rõ trong summary của task.

---

# 3. Engineering Rules

Mỗi feature phải tuân theo các nguyên tắc sau.

## 3.1 Separation of concerns

Ưu tiên cấu trúc:

```text
UI
↓
Domain / Service
↓
Storage / Repository
↓
Sync
```

Không đặt business logic phức tạp trực tiếp trong React component.

## 3.2 Deterministic logic first

Các logic sau phải deterministic, không gọi AI:

- Mastery calculation.
- Weakness ranking.
- Daily plan priority calculation.
- Streak calculation.
- Session statistics.
- Accuracy calculation.
- Trend calculation.
- Due item calculation.

AI chỉ dùng cho:

- Sinh nội dung.
- Giải thích.
- Chấm nội dung mở.
- Feedback.
- Roleplay.
- Writing / Speaking analysis.

## 3.3 Validation

AI output có cấu trúc phải được validate bằng schema.

Nếu response invalid:

1. Thử repair theo cơ chế hiện tại.
2. Nếu vẫn invalid, trả error rõ ràng.
3. Không ghi dữ liệu invalid vào storage.

## 3.4 Testing

Mọi task phải thêm hoặc cập nhật tests khi thay đổi logic.

Bắt buộc verify:

```bash
npm test
npm run lint
npm run build
```

Task không được coi là hoàn thành nếu một trong ba bước trên fail do thay đổi vừa implement.

---

# 4. High-Level Dependency Graph

```text
Learning Session
      │
      ├───────────────┐
      ↓               ↓
Activity History   Learning Statistics
                      │
Unified Mistakes ─────┤
      │               │
      ↓               ↓
Skill Mastery ───→ Learning Insights
      │
      ↓
Today Planner v2
      │
      ├──────────────┬───────────────┐
      ↓              ↓               ↓
Adaptive Grammar Adaptive Exam Adaptive Vocabulary
      │              │               │
      └──────────────┴───────────────┘
                     ↓
              Goal / Learning Path
```

---

# 5. Priority Overview

| Priority | Epic |
|---|---|
| P0 | Learning Session System |
| P0 | Unified Mistake Notebook |
| P0 | Skill Mastery Engine |
| P0 | Smart Today Planner v2 |
| P1 | Grammar v2 |
| P1 | Vocabulary v2 |
| P1 | Exam v2 |
| P1 | Speaking v2 |
| P1 | Writing v2 |
| P1 | Learning Insights |
| P1 Technical | Data & Offline v2 |
| P2 | Goals & Learning Path |
| P2 | Search & Knowledge Library |
| P2 | Notifications |
| P2 | Gamification |
| P2 | AI Engine v2 |

---

# 6. EPIC 1 — Learning Session System

**Priority:** P0

## 6.1 Goal

Tạo khái niệm thống nhất về một phiên học để tất cả module có thể cung cấp dữ liệu chung cho History, Stats, Mastery và Today Planner.

## 6.2 Supported activity types

```ts
type LearningActivityType =
  | "vocabulary"
  | "review"
  | "grammar"
  | "exam"
  | "speaking"
  | "writing";
```

## 6.3 Proposed data model

```ts
interface LearningSession {
  id: string;
  type: LearningActivityType;

  startedAt: string;
  finishedAt?: string;

  durationSeconds: number;

  totalItems?: number;
  correctItems?: number;

  metadata?: Record<string, unknown>;
}
```

## 6.4 Requirements

### Session lifecycle

Hệ thống phải hỗ trợ:

- `startSession()`
- `updateSession()`
- `finishSession()`
- `cancelSession()`
- `getSessions()`
- `getSessionsForDate()`
- `getRecentSessions()`

### Session creation

Session phải được tạo cho:

- Vocabulary learning.
- SRS review.
- Grammar quiz / exercise.
- Exam drill.
- Mock test.
- Speaking session.
- Writing session.

### Session completion

Một session chỉ được finish khi hoạt động hoàn thành hợp lệ.

Không được tạo duplicate session khi:

- User refresh.
- React component remount.
- Navigate trong cùng flow.
- Result screen được mở lại.

## 6.5 Review Session Summary

Sau SRS review, hiển thị:

- Tổng số từ review.
- Again count.
- Hard count.
- Good count.
- Easy count.
- Accuracy hoặc success rate.
- Duration.
- Mastery before.
- Mastery after.
- Số từ due tiếp theo nếu có thể tính.

## 6.6 Activity History

Tạo route:

```text
/activity
```

Cho phép xem:

- Sessions theo ngày.
- Loại activity.
- Duration.
- Result summary.
- Link quay lại module liên quan nếu phù hợp.

## 6.7 Acceptance Criteria

- [ ] Mỗi major learning flow tạo tối đa một session hợp lệ.
- [ ] Không tạo duplicate khi refresh.
- [ ] Session history sort newest first.
- [ ] Existing `studyTime` tiếp tục hoạt động.
- [ ] TimerContext không bị duplicate responsibility.
- [ ] Unit tests cho session lifecycle.
- [ ] Old data không có session vẫn hoạt động bình thường.

---

# 7. EPIC 2 — Unified Mistake Notebook

**Priority:** P0

## 7.1 Goal

Thay `Exam Mistake Log` riêng lẻ bằng hệ thống lỗi sai dùng chung xuyên suốt ứng dụng.

## 7.2 Proposed model

```ts
type LearningSkill =
  | "vocabulary"
  | "grammar"
  | "reading"
  | "listening"
  | "speaking"
  | "writing";

type MistakeStatus =
  | "open"
  | "reviewing"
  | "resolved";

interface LearningMistake {
  id: string;

  skill: LearningSkill;
  source: string;
  category?: string;

  prompt?: string;
  userAnswer?: string;
  expectedAnswer?: string;

  explanation?: string;

  createdAt: string;
  reviewedAt?: string;

  status: MistakeStatus;

  mistakeCount: number;

  metadata?: Record<string, unknown>;
}
```

## 7.3 Capture sources

Mistake phải có thể được tạo từ:

### Vocabulary

- Write mode.
- Fill mode.
- Dictation.

### Grammar

- Inline exercise.
- Grammar quiz.

### Exam

- Drill.
- Mock test.

### Speaking

- Grammar correction.
- Vocabulary usage issue.
- Repeated expression issue.

### Writing

- Grammar issue.
- Word choice.
- Cohesion issue.
- Sentence structure issue.

## 7.4 Mistake deduplication

Nếu cùng loại lỗi xảy ra nhiều lần:

- Không nhất thiết tạo record mới hoàn toàn.
- Có thể tăng `mistakeCount`.
- Phải cập nhật `last occurrence` trong metadata hoặc field riêng nếu implement.

Không merge hai lỗi chỉ vì cùng `skill`.

## 7.5 Mistake Notebook UI

Tạo:

```text
/mistakes
```

Filters:

- All.
- Vocabulary.
- Grammar.
- Reading.
- Listening.
- Speaking.
- Writing.
- Open.
- Reviewing.
- Resolved.

## 7.6 Mistake Drill

Cho phép user:

```text
Practice mistakes
```

Flow:

```text
Existing mistake
↓
Generate similar question
↓
User answers
↓
Grade
↓
Update mistake
```

Generated question không được copy nguyên câu cũ.

## 7.7 Recurring weakness

Nếu một category có mistake count vượt threshold:

- Mark as recurring weakness.
- Expose dữ liệu đó cho Mastery Engine và Today Planner.

Threshold phải nằm trong config/domain logic, không hard-code trong UI.

## 7.8 Migration

Existing `mistakeLog` của Exam phải được:

- Giữ nguyên cho đến khi migration hoàn tất.
- Hoặc migrate sang Unified Mistake model.
- Không làm mất lịch sử lỗi hiện tại.

## 7.9 Acceptance Criteria

- [ ] Existing exam mistakes không bị mất.
- [ ] Mistakes từ nhiều skill hiển thị cùng một nơi.
- [ ] Filter hoạt động chính xác.
- [ ] Resolved mistakes có thể reopen nếu lỗi tái diễn.
- [ ] Mistake drill update trạng thái đúng.
- [ ] Unit tests cho merge/dedup/resolution.

---

# 8. EPIC 3 — Skill Mastery Engine

**Priority:** P0

## 8.1 Goal

Tạo một lớp domain thống nhất để đo mức độ thành thạo và điểm yếu của người dùng.

## 8.2 Proposed model

```ts
interface SkillMastery {
  skillId: string;

  skill:
    | "vocabulary"
    | "grammar"
    | "reading"
    | "listening"
    | "speaking"
    | "writing";

  category: string;

  mastery: number; // 0-100

  attempts: number;
  correct: number;

  lastPracticedAt?: string;

  trend:
    | "up"
    | "stable"
    | "down";
}
```

## 8.3 Data inputs

Mastery có thể derive từ:

- Vocabulary repetitions.
- SM-2 quality.
- Grammar exercise accuracy.
- Grammar quiz results.
- Exam question accuracy.
- Speaking grading history.
- Writing grading history.
- Mistake frequency.
- Recency.

## 8.4 Requirements

Phải cung cấp domain functions tối thiểu:

```ts
getSkillMastery()
getCategoryMastery()
getWeakestSkills()
getStrongestSkills()
getSkillTrend()
recalculateMastery()
```

## 8.5 Rules

- Mastery nằm trong range `0-100`.
- Không gọi AI để tính mastery.
- Không reset mastery chỉ vì user không học trong một ngày.
- Có thể áp dụng recency decay nhưng phải nhẹ và có test.
- Ít sample phải được xử lý khác dữ liệu nhiều sample.
- Tránh hiển thị confidence quá cao khi attempts quá ít.

## 8.6 Initial adapters

Phase đầu phải hỗ trợ ít nhất:

1. Vocabulary.
2. Grammar.
3. Exam.

Speaking/Writing có thể tích hợp sau.

## 8.7 Acceptance Criteria

- [ ] Calculation deterministic.
- [ ] Same input luôn cho same output.
- [ ] Mastery nằm trong 0-100.
- [ ] Weakest skill được sort chính xác.
- [ ] Không crash khi không có history.
- [ ] Unit tests cho low sample, high sample, all correct, all wrong, stale data.

---

# 9. EPIC 4 — Smart Today Planner v2

**Priority:** P0

## 9.1 Goal

Biến `/today` thành màn hình trung tâm của ứng dụng.

## 9.2 Inputs

Planner phải sử dụng:

- SRS due count.
- SRS debt.
- Skill mastery.
- Recent mistakes.
- Recurring mistakes.
- Exam weakness.
- Grammar weakness.
- Speaking inactivity.
- Writing inactivity.
- Daily study goal.
- Activities đã hoàn thành hôm nay.

## 9.3 Daily study goal

Settings phải hỗ trợ:

```text
15 minutes
30 minutes
45 minutes
60 minutes
Custom
```

Suggested storage:

```ts
interface LearningPreferences {
  dailyStudyGoalMinutes: number;
}
```

## 9.4 Proposed plan model

```ts
interface DailyPlanBlock {
  id: string;

  type:
    | "review"
    | "vocabulary"
    | "grammar"
    | "exam"
    | "speaking"
    | "writing"
    | "mistake";

  title: string;

  estimatedMinutes: number;

  reason: string;

  completed: boolean;

  href: string;

  metadata?: Record<string, unknown>;
}
```

## 9.5 Planning priority

Default priority:

1. Overdue SRS.
2. Severe recurring mistake.
3. Very weak skill.
4. Speaking/Writing inactivity.
5. Normal practice.
6. New content.

Priority logic phải nằm trong domain service.

## 9.6 Time allocation

Planner phải:

- Tôn trọng daily study goal.
- Không tạo quá nhiều block nhỏ.
- Ưu tiên activity giá trị cao.
- Không vượt goal quá nhiều nếu không cần thiết.
- Cho phép block cuối cùng linh hoạt vài phút.

## 9.7 Reason explanation

Mỗi block cần `reason`.

Ví dụ:

```text
Your preposition accuracy is 46%.
You made 5 related mistakes this week.
```

Reason phải derive từ data, không cần AI.

## 9.8 Daily regeneration

Plan:

- Generate một lần mỗi ngày.
- Persist trong `dailyPlan`.
- Không regenerate ngẫu nhiên mỗi refresh.
- Cho phép manual regenerate.
- Khi regenerate phải giữ completed activity nếu phù hợp.

## 9.9 Acceptance Criteria

- [ ] Daily goal ảnh hưởng plan.
- [ ] Overdue review luôn được ưu tiên.
- [ ] Completed block không trở lại incomplete sau refresh.
- [ ] Plan không đổi ngẫu nhiên khi reload.
- [ ] Reason phản ánh đúng source data.
- [ ] Planner có tests với nhiều input scenario.

---

# 10. EPIC 5 — Grammar v2

**Priority:** P1

## 10.1 Goal

Biến Grammar từ content browser thành learning module có progress, quiz, bookmark và mistake integration.

## 10.2 Grammar Progress model

```ts
interface GrammarProgress {
  topicId: string;
  subRuleId: string;

  viewed: boolean;

  attempts: number;
  correct: number;

  mastery: number;

  lastPracticedAt?: string;
}
```

## 10.3 Progress requirements

Track:

- Sub-rule viewed.
- Exercise attempts.
- Correct answers.
- Incorrect answers.
- Accuracy.
- Last practiced.
- Mastery.

## 10.4 Grammar Quiz

Quiz configuration:

```text
Question count:
5
10
20

Difficulty:
Easy
Medium
Hard

Scope:
All rules
Weak rules only
Mistakes only
```

## 10.5 Bookmark

Cho phép bookmark:

- Topic.
- Sub-rule.

Tạo:

```text
/grammar/bookmarks
```

## 10.6 Explain My Mistake

Khi answer sai, user có thể gọi AI giải thích.

Context chỉ gửi:

- Rule.
- Question.
- User answer.
- Correct answer.

Không gửi toàn bộ user history.

## 10.7 Acceptance Criteria

- [ ] Existing static topics không bị thay đổi cấu trúc không cần thiết.
- [ ] User-generated topics tiếp tục hoạt động.
- [ ] Progress hiển thị ở sidebar/list.
- [ ] Quiz ghi session.
- [ ] Wrong answer ghi Unified Mistake.
- [ ] Bookmark persist.
- [ ] AI explanation xử lý loading/error.

---

# 11. EPIC 6 — Vocabulary v2

**Priority:** P1

## 11.1 Goal

Mở rộng Vocabulary thành hệ thống học theo context và adaptive practice.

## 11.2 CEFR / difficulty

Hỗ trợ optional metadata:

```ts
type CefrLevel =
  | "A1"
  | "A2"
  | "B1"
  | "B2"
  | "C1"
  | "C2";
```

Không bắt buộc migrate toàn bộ word cũ ngay.

## 11.3 Word relationship

Cho phép lưu hoặc generate:

- Synonym.
- Antonym.
- Word family.
- Related words.
- Part of speech.

## 11.4 Context Story

Cho phép chọn một nhóm từ và generate:

- Mini story.
- Dialogue.
- Workplace scenario.
- Daily communication context.

Generated content phải chứa các target words.

## 11.5 Vocabulary Quiz

Modes:

- Meaning.
- Fill.
- Sentence.
- Listening.
- Synonym.
- Mixed.

Quiz phải:

- Ghi Learning Session.
- Capture mistake.
- Update mastery.

## 11.6 Adaptive practice

Các word có pattern:

```text
Again → Again → Hard
```

phải được tăng priority trong practice.

Các word có pattern:

```text
Easy → Easy → Easy
```

có thể giảm frequency ngoài SM-2 review chính.

Không thay đổi SM-2 core nếu không có requirement riêng.

## 11.7 Acceptance Criteria

- [ ] Old LearnedWord records vẫn đọc được.
- [ ] Optional metadata không làm migration bắt buộc.
- [ ] Quiz integration với session/mistake/mastery.
- [ ] Context story có target words.
- [ ] No duplicate word creation khi save.

---

# 12. EPIC 7 — Exam v2

**Priority:** P1

## 12.1 Goal

Bổ sung adaptive drill, question tagging, analytics và mock history.

## 12.2 Question tagging

Exam item nên hỗ trợ optional tags:

```ts
tags?: string[];
```

Examples:

```text
preposition
verb-form
business
office
inference
main-idea
```

## 12.3 Adaptive Drill

Distribution mặc định:

```text
70% weak categories
20% normal categories
10% strong categories
```

Tỷ lệ phải configurable.

## 12.4 Difficulty adaptation

Có thể tăng difficulty khi:

- Nhiều câu đúng liên tiếp.
- Accuracy cao trên category.

Có thể giảm khi:

- Sai liên tiếp.
- Response time quá lâu nếu đã track.

Không thay đổi difficulty giữa mỗi câu quá aggressive.

## 12.5 Exam analytics

Result phải hiển thị:

- Score.
- Accuracy.
- Accuracy by category.
- Strong categories.
- Weak categories.
- Average response time nếu available.
- Mistakes count.

## 12.6 Mock History

Tạo:

```text
/exam/mock/history
```

Hiển thị:

- Date.
- Exam type.
- Duration.
- Accuracy.
- Estimated score nếu có.
- Trend.

Estimated score phải được ghi rõ là estimated nếu mock không tương đương full official test.

## 12.7 Acceptance Criteria

- [ ] Existing drill vẫn hoạt động.
- [ ] Existing exam bank cache không bị phá.
- [ ] Tag field optional.
- [ ] Adaptive logic deterministic.
- [ ] Weak categories được ưu tiên.
- [ ] Wrong answers ghi Unified Mistake.
- [ ] Exam session ghi Learning Session.

---

# 13. EPIC 8 — Speaking v2

**Priority:** P1

## 13.1 Goal

Bổ sung history, retry, correction tracking và shadowing.

## 13.2 Speaking Attempt model

```ts
interface SpeakingAttempt {
  id: string;

  mode:
    | "roleplay"
    | "ielts";

  transcript: string;

  duration: number;

  scores?: {
    fluency?: number;
    grammar?: number;
    vocabulary?: number;
    pronunciation?: number;
  };

  corrections?: SpeakingCorrection[];

  createdAt: string;
}
```

## 13.3 History

Tạo:

```text
/speak/history
```

Cho phép:

- View transcript.
- View score.
- View corrections.
- Retry activity.

## 13.4 Transcript annotations

UI phải hỗ trợ inline correction.

Example:

```text
I [go] to work yesterday.
   ↓
  went
```

## 13.5 Retry response

Cho phép user:

```text
Try again
```

Sau retry hiển thị:

- Original.
- Retry.
- Improvement summary.

## 13.6 Shadowing

Flow:

```text
Listen
↓
Record
↓
Transcribe
↓
Compare
```

Version đầu không yêu cầu phoneme-level pronunciation scoring.

## 13.7 Acceptance Criteria

- [ ] Existing roleplay không bị phá.
- [ ] Existing IELTS flow không bị phá.
- [ ] Attempt history persist.
- [ ] Retry link với original attempt.
- [ ] Speaking mistakes có thể đẩy vào Unified Mistake.
- [ ] Session được ghi.

---

# 14. EPIC 9 — Writing v2

**Priority:** P1

## 14.1 Goal

Biến Writing từ one-shot grading thành iterative learning flow.

## 14.2 Writing history

Tạo:

```text
/write/history
```

## 14.3 Draft versioning

Suggested model:

```ts
interface WritingDraftVersion {
  id: string;
  attemptId: string;

  version: number;

  content: string;

  createdAt: string;

  feedback?: WritingFeedback;
}
```

## 14.4 Rewrite Mode

Không tự động rewrite toàn bài cho user.

Flow ưu tiên:

```text
Issue
↓
Original sentence
↓
Explanation
↓
User rewrite
↓
Check
```

## 14.5 Mistake patterns

Track các category lặp lại:

- Articles.
- Subject-verb agreement.
- Tense.
- Word choice.
- Cohesion.
- Sentence fragments.
- Run-on sentences.

## 14.6 Acceptance Criteria

- [ ] Existing grade result vẫn đọc được.
- [ ] History load được old attempts nếu có.
- [ ] Multiple draft versions không overwrite nhau.
- [ ] Rewrite exercise ghi mistake resolution.
- [ ] Session được ghi.
- [ ] Model answer vẫn giữ như reference, không thay user rewrite flow.

---

# 15. EPIC 10 — Learning Insights

**Priority:** P1

## 15.1 Goal

Chuyển Stats từ mô tả dữ liệu sang actionable learning insights.

## 15.2 Weekly Report

Hiển thị:

- Total study time.
- Change vs previous week.
- New words.
- Review accuracy.
- Exam accuracy.
- Grammar accuracy.
- Strongest improvement.
- Skills needing attention.
- Current streak.
- Number of sessions.

## 15.3 Skill Trend

Cho từng skill:

```text
up
stable
down
```

Trend phải dựa trên rolling historical window.

## 15.4 Rule-based recommendation

Version đầu không cần AI.

Examples:

```text
IF SRS due > threshold
  prioritize review

IF grammar mastery < threshold
  recommend grammar drill

IF speaking inactive > N days
  recommend speaking

IF recurring mistake exists
  recommend mistake practice
```

## 15.5 Acceptance Criteria

- [ ] Weekly comparison chính xác theo local timezone.
- [ ] Không crash khi thiếu tuần trước.
- [ ] Recommendations explainable.
- [ ] Same data cho same recommendations.
- [ ] Không gọi AI mặc định.

---

# 16. EPIC 11 — Data & Offline v2

**Priority:** P1 Technical

## 16.1 Goal

Tạo nền tảng data đáng tin cậy trước khi lượng dữ liệu tăng mạnh.

## 16.2 Target architecture

```text
React UI
↓
Repository
↓
Local DB
↓
Sync Queue
↓
Supabase
```

## 16.3 Repository abstraction

UI không nên trực tiếp phụ thuộc `localStorage` cho feature mới.

Tạo repository/service layer theo domain.

## 16.4 IndexedDB

Có thể migrate dần data lớn sang IndexedDB.

Không bắt buộc migrate toàn bộ trong một task.

Ưu tiên:

1. Learning Sessions.
2. Mistakes.
3. Speaking history.
4. Writing history.
5. Exam history.

## 16.5 Offline queue

Suggested model:

```ts
interface SyncOperation {
  id: string;

  type:
    | "CREATE"
    | "UPDATE"
    | "DELETE";

  entity: string;
  entityId: string;

  payload?: unknown;

  attempts: number;

  createdAt: string;
  lastAttemptAt?: string;
}
```

## 16.6 Retry

- Retry khi network trở lại.
- Exponential backoff.
- Max retry policy.
- Failed operation phải observable.
- Không silently drop data.

## 16.7 Sync status

UI states:

```text
Synced
Syncing
Offline
Pending changes
Sync error
```

## 16.8 Conflict resolution

Conflict strategy phải define theo entity.

Không áp dụng một rule `"newer wins"` cho mọi loại data.

Examples:

- Session: append-only.
- Mistake count: merge.
- Settings: latest update.
- Completed daily block: completed wins.
- Deleted entity: tombstone hoặc defined delete rule.

## 16.9 Acceptance Criteria

- [ ] Offline action vẫn update UI.
- [ ] Pending mutation được persist.
- [ ] Online lại tự sync.
- [ ] Không duplicate entity.
- [ ] Failed sync không mất data.
- [ ] Existing localStorage users migrate an toàn.

---

# 17. EPIC 12 — Goals & Learning Path

**Priority:** P2

## 17.1 Goal

Cho phép app hiểu mục tiêu cá nhân và điều chỉnh plan.

## 17.2 Learning profile

```ts
interface LearningProfile {
  goal:
    | "toeic"
    | "ielts"
    | "communication"
    | "vocabulary"
    | "mixed";

  level?: string;

  dailyMinutes: number;

  targetScore?: number;

  targetDate?: string;
}
```

## 17.3 Onboarding

Questions:

1. Main goal.
2. Current level.
3. Daily study time.
4. Optional target score.
5. Optional target date.

## 17.4 Learning Path

Path phải:

- Không khóa user vào một course cứng.
- Sử dụng profile + mastery.
- Có thể thay đổi khi goal thay đổi.
- Feed data cho Today Planner.

## 17.5 Acceptance Criteria

- [ ] Existing user không bị forced onboarding blocking.
- [ ] User có thể skip.
- [ ] User có thể edit profile trong Settings.
- [ ] Plan phản ánh goal mới sau regenerate.

---

# 18. EPIC 13 — Search & Knowledge Library

**Priority:** P2

## 18.1 Goal

Tạo một nơi search xuyên suốt knowledge của user.

## 18.2 Route

```text
/library
```

## 18.3 Search domains

Search:

- Learned words.
- Grammar topics.
- Grammar bookmarks.
- Mistakes.
- Exam categories / questions nếu phù hợp.
- Writing corrections.
- Speaking corrections.

## 18.4 Requirements

- Local search trước.
- Không gọi AI cho simple text search.
- Hỗ trợ debounced search.
- Search phải case-insensitive.
- Highlight matching text nếu phù hợp.

## 18.5 Acceptance Criteria

- [ ] Search hoạt động offline với local data.
- [ ] Empty query không trigger expensive scan không cần thiết.
- [ ] Results grouped by domain.
- [ ] Clicking result điều hướng đúng.

---

# 19. EPIC 14 — Notifications

**Priority:** P2

## 19.1 Goal

Nhắc user đúng lúc nhưng không spam.

## 19.2 Notification types

- Today plan ready.
- SRS due.
- Streak at risk.
- Speaking inactivity.
- Writing inactivity.

## 19.3 Settings

```text
Study reminder
SRS reminder
Streak reminder
Speaking reminder
Writing reminder
Reminder time
```

## 19.4 Rules

- Notification opt-in.
- Respect browser permission.
- Không spam nhiều notification cùng lúc.
- Có cooldown.
- Không gửi notification nếu user vừa hoàn thành task tương ứng.

## 19.5 Acceptance Criteria

- [ ] Permission denied không gây lỗi.
- [ ] Reminder settings persist.
- [ ] Notification logic testable.
- [ ] No duplicate notifications for same event/day.

---

# 20. EPIC 15 — Gamification

**Priority:** P2

## 20.1 Goal

Tăng motivation nhưng không làm sai learning metrics.

## 20.2 XP

Có thể cộng XP cho:

- Vocabulary.
- Review.
- Grammar.
- Exam.
- Speaking.
- Writing.

## 20.3 Rule

XP **không được dùng để tính mastery**.

## 20.4 Achievements

Examples:

- 7 Day Streak.
- 100 Words.
- 500 Reviews.
- First Essay.
- 10 Speaking Sessions.
- 100 Grammar Questions.

## 20.5 Daily Challenge

Mở rộng `dailyChallenge` hiện tại thành progress dashboard.

## 20.6 Acceptance Criteria

- [ ] XP deterministic.
- [ ] Không farm XP bằng reload.
- [ ] Achievement unlock một lần.
- [ ] Existing dailyChallenge data không mất.

---

# 21. EPIC 16 — AI Engine v2

**Priority:** P2

## 21.1 Goal

Nâng multi-provider fallback thành task-aware AI routing layer.

## 21.2 Proposed task types

```ts
type AITask =
  | "word-generation"
  | "sentence-generation"
  | "grammar-generation"
  | "grammar-explanation"
  | "exam-generation"
  | "exam-explanation"
  | "speaking-roleplay"
  | "speaking-feedback"
  | "writing-grade"
  | "writing-feedback";
```

## 21.3 API abstraction

Target usage:

```ts
callAI({
  task: "exam-generation",
  input,
  schema: ExamItemSchema,
});
```

## 21.4 Routing factors

Router có thể xem:

- Task type.
- Latency requirement.
- Structured output requirement.
- Quality requirement.
- Provider health.
- Disabled providers.
- Preferred provider.

## 21.5 Provider metrics

Track:

- Request count.
- Success count.
- Failure count.
- Average latency.
- Fallback count.
- JSON repair count.
- Validation error count.

## 21.6 Prompt registry

Prompt không nên phân tán quá nhiều trong route files.

Có thể tạo:

```text
src/lib/ai/prompts/
```

hoặc cấu trúc tương đương.

Mỗi prompt nên:

- Có task name.
- Có version.
- Có schema expectation nếu structured.
- Dễ test.

## 21.7 Acceptance Criteria

- [ ] Existing provider fallback vẫn hoạt động.
- [ ] Client không import provider code.
- [ ] API keys vẫn server-only.
- [ ] Router failure fallback đúng.
- [ ] Metrics không expose secret.
- [ ] Structured response được validate.

---

# 22. Cross-Feature Requirements

## 22.1 Local timezone

Các feature theo ngày/tuần phải dùng local date nhất quán.

Bao gồm:

- Daily plan.
- Streak.
- Weekly insights.
- Session grouping.
- Study time.
- Diary.
- Notifications.

Không sử dụng UTC date slicing trực tiếp nếu có thể gây lệch ngày local.

## 22.2 Accessibility

Feature mới nên:

- Có keyboard navigation cơ bản.
- Button có accessible name.
- Form có label.
- Không dùng màu làm tín hiệu duy nhất.
- Loading state rõ ràng.

## 22.3 Mobile

Tất cả feature mới phải usable trên viewport mobile.

Đặc biệt:

- `/today`
- `/mistakes`
- `/activity`
- Grammar quiz.
- Exam result.
- Speaking history.
- Writing history.

## 22.4 Loading / error states

Mọi AI feature phải có:

- Loading.
- Retry.
- Error message.
- Không mất input của user khi request fail.

## 22.5 Analytics

Nếu dùng Firebase Analytics:

- Không log API key.
- Không log full essay/transcript nếu không cần.
- Không log sensitive raw content mặc định.

---

# 23. Migration Strategy

## Phase A

Giữ:

```text
localStorage primary
Supabase sync
```

Thêm model mới theo kiểu additive.

## Phase B

Tạo repository abstraction.

Feature mới đọc/ghi qua repository.

## Phase C

Migrate data volume lớn sang IndexedDB.

## Phase D

Triển khai offline mutation queue.

## Phase E

Refactor Supabase sync per entity.

Không thực hiện toàn bộ migration trong một PR lớn.

---

# 24. Execution Batches

Các AI coding agent nên implement theo batch sau.

## Batch 1 — Foundation

1. Learning Session model.
2. Learning Session storage.
3. Review Session Summary.
4. Activity History.

## Batch 2 — Adaptive Core

5. Unified Mistake model.
6. Existing Exam Mistake migration.
7. Mistake capture.
8. Mistake Notebook UI.
9. Skill Mastery engine.
10. Weakness calculation.

## Batch 3 — Smart Learning

11. Daily Study Goal.
12. Today Planner v2.
13. Recommendation reason.
14. Plan completion tracking.

## Batch 4 — Grammar + Vocabulary

15. Grammar Progress.
16. Grammar Quiz.
17. Grammar Bookmark.
18. Vocabulary Quiz.
19. Vocabulary Context Story.
20. Adaptive vocabulary practice.

## Batch 5 — Exam

21. Question tagging.
22. Exam analytics.
23. Adaptive Drill.
24. Mock History.

## Batch 6 — Speaking + Writing

25. Speaking History.
26. Speaking Retry.
27. Transcript corrections.
28. Shadowing.
29. Writing History.
30. Draft Versioning.
31. Rewrite Practice.

## Batch 7 — Insights

32. Weekly Report.
33. Skill Trend.
34. Learning Recommendations.
35. Accurate Streak calculation.

## Batch 8 — Platform

36. Repository abstraction.
37. IndexedDB introduction.
38. Offline Queue.
39. Conflict Resolution.
40. Sync Status UI.

## Batch 9 — Product Features

41. Learning Profile.
42. Onboarding.
43. Learning Path.
44. Notifications.
45. Global Library Search.
46. Gamification.

## Batch 10 — AI Infrastructure

47. AI Task abstraction.
48. Task Router.
49. Provider metrics.
50. Structured response improvements.
51. Prompt registry.

---

# 25. AI Coding Agent Task Template

Mỗi task giao cho Codex / Claude Code nên theo format:

```text
TASK
<Feature name>

CONTEXT
Read APP_OVERVIEW.md.
Read FEATURE_REQUIREMENTS.md.
Inspect related source files before editing.

GOAL
<One clear objective>

REQUIREMENTS
1. ...
2. ...
3. ...

CONSTRAINTS
- Next.js App Router.
- TypeScript.
- Preserve backward compatibility.
- localStorage remains primary until Data & Offline v2.
- Client must never import src/lib/providers.
- Do not expose API keys.
- Do not add dependencies unless necessary.
- Keep existing UI patterns.
- Avoid unrelated refactors.

DATA MIGRATION
<Describe required migration or state "none">

TESTS
Add or update tests for:
- happy path
- empty state
- old data
- error state
- edge cases

VERIFY
npm test
npm run lint
npm run build

DELIVER
1. Summary.
2. Files changed.
3. Tests added/updated.
4. Migration notes.
5. Known limitations.
6. Suggested next task.
```

---

# 26. Definition of Done

Một feature chỉ được xem là hoàn thành khi:

- [ ] Requirement chính đã implement.
- [ ] Không có unrelated refactor.
- [ ] Existing data tương thích.
- [ ] Loading/error/empty state có xử lý.
- [ ] Mobile layout usable.
- [ ] Tests pass.
- [ ] Lint pass.
- [ ] Production build pass.
- [ ] Agent cung cấp summary.
- [ ] Agent liệt kê files changed.
- [ ] Agent ghi rõ migration nếu có.
- [ ] `APP_OVERVIEW.md` được cập nhật nếu kiến trúc hoặc trạng thái hệ thống thực sự thay đổi.

---

# 27. Recommended First Implementation Order

Không bắt đầu từ Gamification, Notifications hoặc AI Router.

Thứ tự khuyến nghị:

```text
1. Learning Session
       ↓
2. Unified Mistakes
       ↓
3. Skill Mastery
       ↓
4. Today Planner v2
       ↓
5. Grammar / Vocabulary adaptation
       ↓
6. Exam adaptation
       ↓
7. Speaking / Writing history
       ↓
8. Learning Insights
       ↓
9. Data & Offline v2
       ↓
10. Product / AI infrastructure
```

Bốn Epic đầu tiên tạo nền tảng để các feature về sau dùng chung dữ liệu, tránh việc mỗi module tiếp tục phát triển thành một hệ thống độc lập.

---

# 28. Non-Goals for Initial Expansion

Các mục sau chưa phải ưu tiên ở giai đoạn đầu:

- Social network.
- Public leaderboard.
- Teacher marketplace.
- Payment / subscription.
- Multi-tenant organization.
- Real-time multiplayer learning.
- Full LMS.
- Complex course authoring system.
- Phoneme-level pronunciation engine tự xây dựng.
- Training custom language model.

Chỉ triển khai nếu có requirement riêng sau này.

---

# 29. Source of Truth

Khi có mâu thuẫn:

1. Existing working code quyết định behavior hiện tại.
2. `APP_OVERVIEW.md` mô tả kiến trúc và trạng thái hiện tại.
3. `FEATURE_REQUIREMENTS.md` mô tả behavior và feature mục tiêu tương lai.
4. Requirement cụ thể của task hiện tại có thể override tài liệu này nếu ghi rõ.

Không tự ý thay đổi architecture lớn chỉ vì requirement ở đây mang tính định hướng.

---

# 30. Final Development Principle

Mục tiêu chính không phải thêm nhiều màn hình nhất có thể.

Mục tiêu là tạo vòng lặp học:

```text
Learn
↓
Practice
↓
Make mistakes
↓
Measure mastery
↓
Identify weakness
↓
Generate next plan
↓
Practice weakness
↓
Measure improvement
```

Mọi feature mới nên hỗ trợ trực tiếp hoặc gián tiếp cho vòng lặp trên.
