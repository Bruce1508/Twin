# Tutor Support Feature — Design Spec
Date: 2026-06-23

## Context
Linguistic Twin là single-user app học tiếng Pháp (Bruce, TCF Canada B2).
Bạn tôi dạy kèm, gặp trực tiếp, mỗi người một MacBook.
Deploy lên Vercel để giáo viên mở được link trên MacBook riêng.

## Problem
App hiện tại không có tính năng dành cho giáo viên. Giáo viên không thể xem tiến độ, ghi chú, hoặc giao bài.

## Solution: Passcode Tutor Mode

### Authentication
- `TUTOR_PASSCODE` env var lưu passcode (set trên Vercel)
- `POST /api/tutor/auth`: verify passcode → trả token
- Client lưu token trong localStorage (`tutor_auth`)

### Layout: 3-Tab Dashboard

**Tab 1: Báo cáo**
- Tổng hoạt động tuần: số bài, số lỗi, số từ
- Accuracy từng kỹ năng: viết, đọc, nói, nghe
- Top 10 lỗi hay gặp (frequency bars + ví dụ thật)
- Complexity trend (độ dài câu theo thời gian)

**Tab 2: Lịch sử bài**
- Danh sách Submission mới nhất trước
- Mỗi dòng: ngày, kỹ năng, số từ, số lỗi, rubric
- Click để expand: xem full text + từng lỗi

**Tab 3: Ghi chú & Bài tập**
- Ghi chú buổi học (notes textarea)
- Giao bài tập (homework textarea - free-form)
- Lưu → POST /api/tutor/notes
- Bài tập hiển thị nổi bật trên trang chủ học sinh

### Student Home Page
Nếu có homework đang active → show amber card: "📚 Bài tập từ giáo viên: ..."

### DB Model
```prisma
model TutorNote {
  id        String   @id @default(cuid())
  notes     String   @default("")
  homework  String   @default("")
  createdAt DateTime @default(now())
}
```

### API Routes
- POST /api/tutor/auth — verify passcode
- GET /api/tutor/report — aggregated stats
- GET /api/tutor/history — submissions list
- GET /api/tutor/notes — latest note
- POST /api/tutor/notes — save note (requires auth)
- GET /api/tutor/homework — latest homework (public, dùng cho student home)

### Design
- Zinc base (match existing app)
- Amber accent: active tab, headers, homework card
- Passcode screen: centered elegant card

## Out of Scope
- Comment trên specific error
- Vercel deployment (separate)
- Session scheduling
