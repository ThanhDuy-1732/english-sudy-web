# English Study App — Development Direction

> Tài liệu định hướng phát triển để sử dụng làm context cho Codex / Claude Code khi lập kế hoạch triển khai.
>
> **Source of current state:** `APP_OVERVIEW.md`
>
> **Mục tiêu:** mô tả hướng phát triển, thứ tự ưu tiên, dependency và kết quả mong muốn ở mức product/architecture. AI coding agent phải tự đọc code hiện tại, đối chiếu `APP_OVERVIEW.md`, sau đó lập implementation plan chi tiết trước khi sửa code.

---

# 1. Current Product Position

Ứng dụng hiện đã có nền tảng tương đối hoàn chỉnh cho một personal English learning PWA:

- Vocabulary learning theo chủ đề.
- Flashcard với Study / Write / Fill / Dictation.
- SM-2 spaced repetition.
- Review session summary.
- Grammar learning.
- TOEIC / IELTS drill và mock test.
- Exam mistake log.
- Speaking với recording, Whisper STT và AI grading.
- Writing với AI grading.
- Learning Session tracking.
- Activity history.
- Daily study plan.
- Stats / charts / weakness analysis.
- Study diary.
- Bulk vocabulary import.
- Supabase multi-device sync.
- AI multi-provider fallback.
- IndexedDB audio storage.
- Firebase Hosting / PWA.
- Automated test suite.

Ứng dụng đã vượt qua giai đoạn MVP.

Hướng phát triển tiếp theo không nên tập trung vào việc thêm nhiều module độc lập, mà nên biến toàn bộ dữ liệu hiện có thành một **adaptive learning system**.

---

# 2. Main Product Direction

Mục tiêu dài hạn:

```text
Learn
↓
Practice
↓
Record activity
↓
Detect mistakes
↓
Measure mastery
↓
Identify weaknesses
↓
Generate personalized study plan
↓
Adaptive practice
↓
Measure improvement
↓
Update learning strategy
```

Các module Vocabulary, Grammar, Exam, Speaking và Writing phải dần chia sẻ cùng một learning model thay vì hoạt động như các feature tách biệt.

---

# 3. Development Principles

## 3.1 Adaptive learning over feature count

Ưu tiên feature giúp hệ thống hiểu người học hơn:

- Người dùng yếu kỹ năng nào?
- Yếu topic nào?
- Lỗi nào lặp lại nhiều?
- Kỹ năng nào lâu chưa luyện?
- Nội dung nào nên học tiếp?
- Có bao nhiêu thời gian học hôm nay?

Không ưu tiên thêm feature chỉ để tăng số lượng màn hình.

## 3.2 Deterministic learning logic first

Các logic sau phải ưu tiên rule-based / deterministic:

- Mastery calculation.
- Weakness calculation.
- Streak.
- Daily-plan prioritization.
- Trend.
- Accuracy.
- Review debt.
- Recommendation reason.

Không dùng AI nếu dữ liệu hiện tại đã đủ để tính toán.

## 3.3 AI as content and feedback engine

AI nên tập trung vào:

- Generate exercises.
- Generate examples.
- Generate exam questions.
- Explain mistakes.
- Speaking roleplay.
- Speaking feedback.
- Writing feedback.
- Contextual vocabulary practice.

## 3.4 Preserve current architecture

Trong các phase đầu:

- Next.js App Router vẫn là framework chính.
- `localStorage` vẫn là primary storage cho dữ liệu hiện tại.
- Supabase tiếp tục dùng cho sync.
- IndexedDB dùng cho dữ liệu lớn phù hợp.
- AI call luôn server-side.
- Client không được import provider implementation.
- API key không bao giờ được expose sang browser.

## 3.5 Backward compatibility

Mọi thay đổi data model phải:

- Không làm mất dữ liệu hiện tại.
- Có migration nếu cần.
- Đọc được record cũ thiếu field mới.
- Không yêu cầu user reset app.

---

# 4. Priority Roadmap

## Phase 1 — Unified Learning Intelligence

**Priority: P0**

Đây là phase quan trọng nhất.

### 4.1 Unified Mistake System

Hiện mistake tracking chủ yếu gắn với Exam.

Cần mở rộng thành một mistake model chung cho:

- Vocabulary.
- Grammar.
- Reading.
- Listening.
- Speaking.
- Writing.

Mỗi mistake nên có:

- Skill.
- Category.
- Source.
- User answer.
- Correct / expected answer.
- Explanation.
- Occurrence count.
- Status.
- Created / updated / reviewed timestamps.

### Expected outcome

Có một nơi duy nhất để trả lời:

```text
Người dùng đang sai gì nhiều nhất?
```

Tạo một global mistake notebook:

```text
/mistakes
```

và có thể filter theo skill/category/status.

---

## Phase 2 — Skill Mastery Engine

**Priority: P0**

Tạo một abstraction chung để đo mức độ thành thạo.

Các hệ thống hiện tại đang sử dụng nhiều thang đo khác nhau:

- Vocabulary mastery.
- Exam accuracy.
- TOEIC score.
- IELTS band.
- Speaking scores.
- Writing scores.

Cần thêm một layer chuẩn hóa nội bộ về `0–100`.

Suggested concept:

```text
Skill
└── Category
    ├── mastery
    ├── confidence
    ├── attempts
    ├── trend
    └── lastPracticedAt
```

Ví dụ:

```text
Grammar
├── Tenses             82
├── Articles           70
├── Prepositions       44
└── Conditionals       63

Reading
├── Main idea          76
├── Inference          51
└── Vocabulary         68
```

### Important

Mastery engine:

- Không gọi AI.
- Phải deterministic.
- Có confidence để tránh kết luận mạnh từ quá ít sample.
- Không để một attempt đơn lẻ thay đổi mastery quá mạnh.
- Có thể derive lại từ history.

### Expected outcome

Có thể xác định:

```text
getWeakestSkills()
getStrongestSkills()
getCategoryMastery()
getSkillTrend()
```

---

## Phase 3 — Today Planner v2

**Priority: P0**

Biến `/today` thành trung tâm của ứng dụng.

Planner mới nên sử dụng:

- SRS due.
- SRS debt.
- Skill mastery.
- Mistake frequency.
- Recurring weaknesses.
- Recent LearningSessions.
- Speaking inactivity.
- Writing inactivity.
- Grammar progress.
- Exam performance.
- Daily available study time.

Ví dụ:

```text
Today's Plan — 30 minutes

1. Vocabulary Review
   12 due words
   6 min

2. Grammar — Prepositions
   Mastery 44%
   7 min

3. TOEIC RC5
   Focus: Prepositions
   8 min

4. Speaking
   Last practice: 3 days ago
   9 min
```

Mỗi block cần có:

- Type.
- Estimated duration.
- Priority.
- Reason.
- Target URL.
- Completion state.

### Recommendation reason

Reason phải explainable.

Ví dụ:

```text
Prepositions mastery is 44%.
You made 5 related mistakes during the last 7 days.
```

Không cần AI để tạo recommendation reason.

---

# 5. Grammar Development

**Priority: P1**

Grammar hiện là module cần hoàn thiện nhiều nhất.

## 5.1 Grammar Progress

Theo dõi:

- Topic đã xem.
- Sub-rule đã xem.
- Exercise attempts.
- Correct / incorrect.
- Accuracy.
- Mastery.
- Last practiced.

Ví dụ:

```text
Conditionals

Zero Conditional       91%
First Conditional      84%
Second Conditional     58%
Third Conditional      Not started
```

## 5.2 Grammar Quiz

Cho phép:

```text
5 / 10 / 20 questions

Easy / Medium / Hard / Adaptive

All rules
Weak rules
Bookmarks
Mistakes
```

Quiz phải tích hợp với:

- LearningSession.
- Unified Mistakes.
- Mastery Engine.

## 5.3 Grammar Bookmark

Cho phép bookmark topic/sub-rule để luyện sau.

## 5.4 Grammar → Exam Integration

Đã có foundation cho TOEIC Part 5 practice theo grammar topic.

Mở rộng thành vòng:

```text
Learn grammar
↓
Grammar quiz
↓
TOEIC contextual practice
↓
Update grammar mastery
```

Mục tiêu là liên kết lý thuyết với performance trong bài thi.

---

# 6. Exam Intelligence

**Priority: P1**

Không ưu tiên thêm nhiều part mới ngay.

Ưu tiên làm Exam thông minh hơn.

## 6.1 Question Tagging

Exam questions nên có metadata như:

```text
preposition
verb-form
articles
inference
main-idea
business
office
```

Nhờ đó có thể phân tích weakness ở cấp category thay vì chỉ part.

## 6.2 Adaptive Drill

Target question distribution nên ưu tiên weakness.

Ví dụ:

```text
70% weak categories
20% normal categories
10% strong categories
```

Tỷ lệ phải configurable.

## 6.3 Difficulty Adaptation

Difficulty có thể tăng/giảm từ:

- Accuracy.
- Consecutive correct/wrong.
- Historical mastery.
- Response time nếu có.

Không thay đổi quá aggressive giữa từng câu.

## 6.4 Question Quality

Bổ sung:

```text
Report question
```

Reasons:

- Wrong answer key.
- Ambiguous.
- Bad explanation.
- Grammar problem.
- Audio problem.
- Other.

Question bị flag nhiều cần giảm priority hoặc loại khỏi bank.

## 6.5 Exam Analytics

Result nên phân tích:

- Overall accuracy.
- Accuracy by category.
- Strong topics.
- Weak topics.
- Mistake count.
- Average response time nếu có.

---

# 7. Speaking v2

**Priority: P1**

Nền tảng speaking đã có:

```text
Record
→ IndexedDB audio
→ Whisper STT
→ AI grade
→ SpeakingRecord
```

Hướng phát triển:

## 7.1 Speaking History

Tạo:

```text
/speak/history
```

Hiển thị:

- Mode.
- Prompt.
- Date.
- Overall score.
- Fluency.
- Vocabulary.
- Grammar.
- Pronunciation.
- Transcript.
- Replay audio.
- Retry.

## 7.2 Retry and Compare

Flow:

```text
Attempt 1
↓
Feedback
↓
Retry
↓
Attempt 2
↓
Compare improvement
```

Mục tiêu không chỉ chấm, mà yêu cầu người dùng sửa.

## 7.3 Transcript Corrections

Highlight trực tiếp lỗi trong transcript.

## 7.4 Shadowing

Triển khai mode `shadowing`:

```text
Listen
↓
Record
↓
Transcribe
↓
Compare
↓
Feedback
```

Version đầu chỉ cần:

- Missing word.
- Wrong word.
- Transcript similarity.
- Speaking speed.
- Pause pattern.

Chưa cần phoneme-level pronunciation engine.

---

# 8. Writing v2

**Priority: P1**

## 8.1 Writing History

Tạo:

```text
/write/history
```

Hiển thị:

- Task type.
- Date.
- Word count.
- Overall band/score.
- Individual criteria.
- Next focus.

## 8.2 Rewrite Practice

AI feedback không nên kết thúc ở việc hiển thị model answer.

Flow:

```text
Problem sentence
↓
Explain issue
↓
User rewrites
↓
Check rewrite
↓
Resolve mistake
```

Ví dụ:

```text
Original:
People is using social media too much.

Issue:
Subject-verb agreement

Your rewrite:
[...]
```

## 8.3 Draft Versioning

Một writing attempt có thể có:

```text
v1
↓
feedback
↓
v2
↓
feedback
↓
v3
```

Cho phép so sánh score qua các version.

## 8.4 Writing Mistake Patterns

Track các lỗi lặp lại:

- Articles.
- Tenses.
- Subject-verb agreement.
- Word choice.
- Cohesion.
- Sentence fragments.
- Run-on sentences.

Feed vào Unified Mistake System.

---

# 9. Vocabulary v2

**Priority: P1**

## 9.1 Vocabulary Quiz

Tạo quiz từ learned vocabulary.

Modes:

- Meaning.
- Fill.
- Dictation.
- Sentence.
- Synonym.
- Mixed.

Không cần gọi AI cho mọi question.

Ví dụ distractor có thể lấy từ vocabulary đã học.

## 9.2 Context Practice

Cho phép chọn một nhóm từ:

```text
deadline
schedule
delay
available
confirm
```

Sau đó generate:

- Mini story.
- Dialogue.
- Email.
- Workplace situation.
- Daily conversation.

Target words phải được sử dụng trong generated content.

## 9.3 Optional Vocabulary Metadata

Có thể mở rộng:

```text
CEFR
Part of speech
Word family
Related words
```

Field mới phải optional để giữ compatibility.

## 9.4 Adaptive Vocabulary Practice

Word thường bị:

```text
Again → Again → Hard
```

nên xuất hiện nhiều hơn trong practice.

Không thay đổi SM-2 core nếu chưa có requirement riêng.

---

# 10. Stats & Learning Insights

**Priority: P1**

Không ưu tiên thêm nhiều chart chỉ để hiển thị dữ liệu.

Mục tiêu mới:

```text
Data
↓
Insight
↓
Action
```

## 10.1 Real Streak

Bổ sung:

- Current streak.
- Longest streak.
- Active days this week.

Định nghĩa active day phải rõ ràng và test được.

## 10.2 Mastery Timeline

Track mastery snapshot theo thời gian.

Ví dụ:

```text
Vocabulary
71 → 74 → 78 → 81

Grammar
62 → 64 → 61 → 68
```

## 10.3 Weekly Learning Report

Hiển thị:

- Study time.
- Change vs previous week.
- Sessions.
- Vocabulary learned.
- SRS accuracy.
- Exam accuracy.
- Speaking progress.
- Writing progress.
- Biggest improvement.
- Weakest area.

## 10.4 Actionable Insight

Ví dụ:

```text
Listening Part 3 accuracy dropped:
68% → 54%

Main weakness:
Inference questions

Recommended action:
Practice 10 inference questions
```

Có nút:

```text
Practice now
```

---

# 11. Offline & Sync Reliability

**Priority: P1 Technical**

Hiện đã có LWW merge nhưng write operations vẫn theo kiểu fire-and-forget.

Đây là technical debt quan trọng.

## 11.1 Offline Mutation Queue

Target:

```text
Local update
↓
Remote sync
↓
Failure?
↓
Persist queue
↓
Network online
↓
Retry
```

Queue operation cần:

- Entity.
- Entity ID.
- Operation type.
- Payload.
- Retry count.
- Created time.
- Last attempt.

## 11.2 Sync Status

UI nên hiển thị:

```text
Synced
Syncing
Offline
Pending changes
Sync failed
```

## 11.3 Entity-specific Conflict Strategy

Không dùng một strategy duy nhất cho mọi data type.

Ví dụ:

```text
Settings
→ LWW

LearningSession
→ append

Mistakes
→ merge

Completed daily block
→ completed wins

Audio
→ local only

Delete
→ tombstone strategy
```

---

# 12. Search & Knowledge Library

**Priority: P2**

Thay vì chỉ thêm search vào History, tạo global knowledge search:

```text
/library
```

Search across:

- Learned vocabulary.
- Grammar topics.
- Grammar bookmarks.
- Mistakes.
- Exam content.
- Speaking corrections.
- Writing corrections.

Search local trước.

Không dùng AI cho basic text search.

---

# 13. Learning Profile & Goals

**Priority: P2**

Tạo learning profile:

```text
Goal
Current level
Daily study time
Target score
Target date
```

Goals:

```text
Communication
TOEIC
IELTS
Vocabulary
Mixed
```

Profile phải ảnh hưởng:

- Today Planner.
- Adaptive drill.
- Learning recommendations.
- Weekly report.
- Learning path.

Existing users không được bị block bởi onboarding.

---

# 14. Dynamic Learning Path

**Priority: P2**

Không xây dựng một course cứng.

Learning Path nên derive từ:

```text
Goal
+
Mastery
+
Weakness
+
Recent mistakes
+
Exam performance
```

Ví dụ:

```text
TOEIC 750 Goal

Current Focus

1. Vocabulary B1/B2
2. RC5 Prepositions
3. Listening Part 3
4. RC7 Inference
```

Path có thể update theo tuần.

---

# 15. UX Improvements

**Priority: P2**

## 15.1 Dark Mode

Support:

```text
System
Light
Dark
```

## 15.2 Keyboard Shortcuts

Flashcard:

```text
Space      Flip
1          Again
2          Hard
3          Good
4          Easy
Enter      Save
← / →      Previous / Next
```

Exam:

```text
1 / 2 / 3 / 4    Select answer
Enter            Submit / Next
```

Cho phép disable shortcuts trong Settings.

## 15.3 Mobile UX

Đảm bảo các route mới hoạt động tốt trên mobile:

```text
/today
/mistakes
/activity
/speak/history
/write/history
/library
```

---

# 16. AI Infrastructure v2

**Priority: P2**

Không refactor AI layer trước Adaptive Learning Core.

Sau khi feature layer ổn định, nâng provider system thành task-aware routing.

Current concept:

```text
API Route
↓
callWithFallback()
```

Target:

```text
Feature
↓
AI Task
↓
Task Router
↓
Provider fallback
```

Suggested tasks:

```text
word-generation
sentence-generation
grammar-generation
grammar-explanation
exam-generation
exam-explanation
speaking-roleplay
speaking-grade
writing-grade
writing-feedback
```

## 16.1 Provider Metrics

Track:

- Provider.
- Model.
- Task.
- Latency.
- Success/failure.
- Fallback.
- Validation error.
- JSON repair.

Không log raw essay/transcript mặc định.

## 16.2 Prompt Registry

Nếu prompt hiện đang phân tán nhiều nơi, cân nhắc đưa về một structured prompt registry.

Prompt nên có:

- Task.
- Version.
- Expected output schema.
- Testability.

---

# 17. Recommended Execution Order

AI coding agent nên lập implementation plan theo thứ tự dependency sau:

```text
1. Unified Mistake System
        ↓
2. Skill Mastery Engine
        ↓
3. Today Planner v2
        ↓
4. Grammar Progress / Quiz / Bookmark
        ↓
5. Exam Tagging / Adaptive Drill / Quality
        ↓
6. Speaking History / Retry / Shadowing
        ↓
7. Writing History / Rewrite / Versioning
        ↓
8. Vocabulary Quiz / Context Practice
        ↓
9. Streak / Mastery Timeline / Weekly Insights
        ↓
10. Offline Queue / Sync Status
        ↓
11. Learning Profile / Learning Path
        ↓
12. Search / Dark Mode / Shortcuts
        ↓
13. AI Task Router / Metrics
```

---

# 18. Suggested Planning Batches

Không implement toàn bộ roadmap trong một plan duy nhất.

## Batch 1 — Adaptive Core

- Unified Mistakes.
- Skill Mastery.
- Today Planner v2.

## Batch 2 — Grammar Intelligence

- Grammar Progress.
- Grammar Quiz.
- Bookmark.
- Grammar ↔ TOEIC integration.

## Batch 3 — Exam Intelligence

- Question tags.
- Adaptive drill.
- Question quality.
- Category analytics.

## Batch 4 — Speaking / Writing Learning Loop

- History.
- Retry.
- Corrections.
- Shadowing.
- Rewrite.
- Draft versions.

## Batch 5 — Vocabulary & Insights

- Vocabulary quiz.
- Context practice.
- Streak.
- Mastery timeline.
- Weekly report.
- Actionable insights.

## Batch 6 — Reliability

- Offline queue.
- Sync status.
- Conflict strategy improvements.

## Batch 7 — Personalization & UX

- Learning profile.
- Dynamic learning path.
- Global search.
- Dark mode.
- Keyboard shortcuts.

## Batch 8 — AI Infrastructure

- AI Task abstraction.
- Router.
- Provider metrics.
- Prompt registry.

---

# 19. Features Not Prioritized Yet

Chưa ưu tiên:

- Social network.
- Friends/following.
- Public leaderboard.
- Teacher marketplace.
- Paid subscription.
- Multi-tenant LMS.
- Real-time collaborative learning.
- Custom model training.
- Custom pronunciation model.
- Complex gamification economy.

Chỉ xem xét sau khi adaptive learning loop hoạt động tốt.

---

# 20. Instructions for AI Planning Agent

Khi dùng tài liệu này với Codex / Claude Code:

1. Đọc `APP_OVERVIEW.md`.
2. Đọc file này.
3. Inspect code hiện tại trước khi đề xuất thay đổi.
4. Xác định feature nào đã tồn tại một phần.
5. Không implement lại feature đã có.
6. Không giả định tài liệu hoàn toàn đồng bộ với code — code thực tế là nguồn kiểm chứng cuối cùng.
7. Lập plan cho từng batch, không lập một mega-plan.
8. Chỉ refactor phần cần thiết cho feature hiện tại.
9. Preserve backward compatibility.
10. Xác định migration trước khi thay data model.
11. Thêm tests trước hoặc cùng lúc với logic mới.
12. Sau mỗi task phải verify:

```bash
npm test
npm run lint
npm run build
```

13. Mỗi plan phải ghi rõ:

```text
Goal
Current implementation
Gap analysis
Files likely affected
Data model changes
Migration
Implementation steps
Tests
Acceptance criteria
Risks
Dependencies
Out of scope
```

---

# 21. Definition of Successful Direction

Roadmap được xem là đi đúng hướng khi app dần có thể trả lời chính xác:

```text
What should the learner study next?
Why?
For how long?
Which weakness does it address?
Did the learner improve after practicing it?
```

Nếu một feature mới không hỗ trợ rõ ràng một trong các mục trên, cần cân nhắc lại priority.

---

# 22. Target Product State

Trạng thái mục tiêu:

```text
User Activity
     ↓
Learning Sessions
     ↓
Mistake Model
     ↓
Mastery Model
     ↓
Weakness Detection
     ↓
Adaptive Today Plan
     ↓
Targeted Practice
     ↓
Progress Measurement
     ↓
Learning Insights
     ↓
Updated Learning Path
```

Khi vòng lặp này hoạt động ổn định, ứng dụng sẽ chuyển từ một English learning toolkit thành một **personal adaptive English learning system**.
