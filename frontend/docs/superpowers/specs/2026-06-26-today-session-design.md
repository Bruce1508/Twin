# "Aujourd'hui" — buổi học không-cần-nghĩ

**Date:** 2026-06-26
**Status:** Design approved (sections), pending spec review

## Vấn đề (root motivation)

Người dùng có deadline thật: **thi DELF A2 trong ~56 ngày**, và *có* ~90 phút/ngày để học. Nỗi sợ không phải thiếu thời gian hay thiếu nội dung — mà là **mất động lực và bỏ giữa chừng**.

Hai nguồn cụ thể của nỗi đau, theo thứ tự ưu tiên đã chốt với người dùng:

1. **Chi phí phải-quyết-định (TRÁI TIM của feature).** Trang chủ hiện tại (`app/page.tsx`) là menu 7 lựa chọn (Écrire / Lire / Parler / Écouter / Réviser / Pratiquer / Profil). Mỗi tối người dùng phải tự chọn 1 trong 7 → mệt → đóng app.
2. **Tội lỗi khi tụt lại + bẫy "tất-cả-hoặc-không".** Bỏ vài ngày → cảm giác "đã hỏng, học tiếp làm gì".

Mục tiêu: biến việc bắt đầu học thành **một hành động duy nhất, không cần suy nghĩ**, và làm cho việc bỏ ngày trở nên **không tốn kém về mặt cảm xúc**.

## Bối cảnh codebase (đã có sẵn)

App là một "Linguistic Twin": theo dõi lỗi của người dùng và sinh bài tập nhắm đúng điểm yếu. Các mảnh đã tồn tại và sẽ được **tái dùng nguyên**:

- API sinh & chấm bài: `api/{reading,listening,speaking,drills}/generate`, `.../[id]/grade`.
- `api/practice/next-target` → `lib/targeting.ts::getNextTarget(userId)` trả về tag lỗi yếu nhất.
- Flashcards SRS: `api/flashcards`, model `Flashcard` (SM-2, `dueAt`).
- `Profile`, `ErrorEvent`, `Submission` (mô hình năng lực đã có).
- Các trang hoạt động: `app/{submit,read,speak,listen,flashcards,practice}`.
- App chạy single-user qua `process.env.DEV_USER_ID`.

Cái **thiếu** là một "nhạc trưởng" xâu chuỗi các mảnh trên thành **một buổi học tuần tự**.

## Phạm vi

### Trong phạm vi (Phase 1)

Một feature **"Aujourd'hui"**: một buổi học hằng ngày được lắp sẵn, chạy tuần tự bằng một nút.

### Ngoài phạm vi (cố tình bỏ — YAGNI)

- Con số điểm DELF dự đoán (hero meter).
- Thông báo / nhắc nhở / streak / XP.
- Phòng thi giả lập với giám khảo AI (ứng viên Phase 2).
- Multi-user / auth thật.
- Đổi nhãn TCF → DELF trong các bài tập hiện có (xem "Câu hỏi mở").

## Thiết kế

### A. Trang chủ — một nút thay cho bảy

`app/page.tsx` đổi: dẫn đầu bằng **một thẻ hero**:

```
┌─────────────────────────────────────────┐
│ AUJOURD'HUI                              │
│ Jour 9 · Routine quotidienne            │
│ ~25 min · 4 étapes                       │
│            [ Commencer → ]               │
└─────────────────────────────────────────┘
```

Bấm **Commencer** → `/today`. Menu 7 ô cũ **vẫn giữ** nhưng đẩy xuống dưới, gập lại dưới nhãn *"Luyện tự do"* cho ai muốn tự chọn. Không xoá gì của luồng cũ.

### B. Luồng `/today` — bộ chạy buổi học (heart)

`app/today/page.tsx` là một **stepper**: hiển thị danh sách bước của buổi hôm nay, đánh dấu bước đang làm, và dẫn người dùng đi hết bước này sang bước kia mà không phải quay lại menu.

**Cơ chế Phase 1 (deep-link stepper — ít code nhất, không nhân đôi UI):**

- `/today` đọc buổi học từ `GET /api/today`, render danh sách bước.
- Bấm bước hiện tại → điều hướng tới trang hoạt động tương ứng (vd `/listen`) kèm query `?session=1`.
- Trang hoạt động, khi người dùng **hoàn thành** (đã chấm xong), gọi `POST /api/today/advance` rồi tự điều hướng về `/today`.
- `/today` hiện bước kế tiếp. Hết bước → màn hình *"Terminé · Jour 9 fait 🎉"* + nút về trang chủ.

> Sửa các trang hoạt động chỉ ở mức tối thiểu: nhận biết `?session=1`, và khi hoàn thành thì gọi advance + quay về `/today`. Không nhân đôi UI.

*(Phase 2 polish, ngoài phạm vi: trích các hoạt động thành component để render inline trong `/today`, bỏ luôn chuyển trang giữa các bước — luồng "seamless" 100%.)*

### C. Buổi học được lắp ra sao — `GET /api/today`

Buổi học ghép từ 3 nguồn:

1. **Plan DELF 56 ngày** (`lib/plan.ts`, mã hoá từ file Excel) → quyết định *chủ đề* và *những kỹ năng nào* xuất hiện hôm nay.
2. **Điểm yếu** (`getNextTarget`) → chèn 1 bước drill nhắm đúng tag lỗi hay sai.
3. **Flashcard đến hạn** (SRS) → 1 bước ôn nếu có thẻ `dueAt <= now()`.

Mỗi "ngày" trong plan có các task cho vocab/grammar/listening/reading/speaking/writing. Ánh xạ task → bước → trang:

| Task trong plan | Bước     | Trang        |
|-----------------|----------|--------------|
| vocab           | Réviser  | `/flashcards`|
| grammar         | Pratiquer| `/practice`  |
| listening       | Écouter  | `/listen`    |
| reading         | Lire     | `/read`      |
| speaking        | Parler   | `/speak`     |
| writing         | Écrire   | `/submit`    |

**Chủ đề của ngày** (vd "Routine quotidienne") được truyền làm topic/seed cho các endpoint `generate` *ở nơi endpoint chấp nhận topic*. (Cần kiểm tra từng endpoint `generate` lúc lập plan; nếu endpoint chưa nhận topic, Phase 1 dùng như hiện trạng, thread topic vào là việc nhỏ làm sau.)

### D. Liều tối thiểu — chống bỏ-tất-cả-hoặc-không

Buổi đầy đủ = mọi bước áp dụng (~90'). Luôn tồn tại **phiên bản tối thiểu ~10'** = chỉ *flashcard đến hạn + 1 drill điểm yếu*. `/today` có một link nhẹ *"Je n'ai que 10 min"* để cắt buổi xuống tối thiểu. Hoàn thành buổi tối thiểu **vẫn được tính là "đã học hôm nay"** và vẫn đẩy `planPosition` tiến 1.

### E. Mô hình tha thứ — hàng đợi, không phải lịch

- `planPosition` = **buổi thứ N người dùng thật sự hoàn thành**, KHÔNG phải ngày lịch thứ N. Chỉ tiến khi hoàn thành một buổi.
- Bỏ nhiều ngày → plan **đứng đợi**. Không bao giờ hiển thị "trễ X ngày", không màu đỏ, không streak vỡ.
- Quay lại → thấy *"Continuer · Jour 9"*.
- Bỏ giữa buổi → `activeSession` lưu trạng thái từng bước; lần sau **tiếp tục đúng chỗ dừng**.
- *(Tuỳ chọn, có thể làm sau:)* nếu người dùng nhập ngày thi, hiện gợi ý nhịp nhẹ ("còn 40 ngày, ~1 buổi/ngày là kịp") — **không bao giờ trách móc**.

### F. Mô hình dữ liệu mới

Một model nhỏ, một dòng cho mỗi user:

```prisma
model SessionProgress {
  id              String    @id @default(cuid())
  userId          String    @unique
  planPosition    Int       @default(1)   // 1-based index vào plan 56 ngày
  activeSession   Json?                    // buổi đang dở: [{ step, route, status }]
  startedAt       DateTime?
  lastCompletedAt DateTime?

  user User @relation(fields: [userId], references: [id])
}
```

### G. API mới

- `GET /api/today` — trả buổi hôm nay. Nếu có `activeSession` chưa xong → trả lại để resume; nếu không → lắp buổi mới từ `plan[planPosition]` + `getNextTarget` + flashcard đến hạn, lưu vào `activeSession`, trả về.
- `POST /api/today/advance` — đánh dấu bước hiện tại `done`. Nếu mọi bước xong → `planPosition += 1`, xoá `activeSession`, set `lastCompletedAt`.

### H. Dữ liệu plan — `lib/plan.ts`

Mảng 56 phần tử, mỗi phần tử mã hoá từ file Excel:

```ts
type PlanDay = {
  day: number;        // 1..56
  week: number;
  theme: string;      // "Routine quotidienne"
  skills: {           // task nào active hôm nay + seed nội dung
    vocab?: string; grammar?: string; listening?: string;
    reading?: string; speaking?: string; writing?: string;
  };
  isReview: boolean;  // ngày 7,14,21,... là review/test
};
```

## Cái mới vs tái dùng

| Thành phần | Trạng thái |
|---|---|
| API sinh/chấm bài, flashcards SRS, `getNextTarget`, `Profile` | **Tái dùng nguyên** |
| `lib/plan.ts` (data 56 ngày) | Mới |
| `GET /api/today`, `POST /api/today/advance` | Mới |
| `app/today/page.tsx` (stepper) | Mới |
| Model `SessionProgress` | Mới |
| `app/page.tsx` thêm thẻ hero, gập menu cũ | Sửa nhỏ |
| Các trang hoạt động: nhận `?session=1`, advance + quay về `/today` | Sửa nhỏ, surgical |

## Câu hỏi mở (không chặn — quyết lúc lập plan)

1. **TCF vs DELF.** App đang gắn nhãn TCF; người dùng thi DELF A2. Hai bài khác format nhưng cùng mức A2. Mặc định Phase 1: **để nguyên các bài tập hiện có**, buổi học chỉ xâu chuỗi chúng. Re-theme sang DELF là việc riêng, sau.
2. **Topic threading.** Cần kiểm tra từng endpoint `generate` xem có nhận `topic` không, để nội dung khớp chủ đề ngày. Nếu chưa, Phase 1 chạy không cần khớp tuyệt đối.

## Tiêu chí thành công

1. Trang chủ dẫn bằng **một nút duy nhất**; không cần chọn gì để bắt đầu học.
2. Bấm Commencer → đi hết một buổi 3–5 bước mà không phải quay lại menu.
3. Bỏ giữa buổi → quay lại tiếp tục đúng chỗ dừng.
4. Bỏ nhiều ngày → không thấy bất kỳ tín hiệu "trễ/hỏng" nào; plan đợi.
5. Có đường "10 phút" luôn hoàn thành được và vẫn tính là đã học.
