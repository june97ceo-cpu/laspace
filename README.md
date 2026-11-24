# LaSpace — Cloudflare deployment (Pages + Workers + D1 + R2)

**LaSpace — Your Language, Your Space.** Không gian học ngôn ngữ cá nhân:
mỗi người dùng có tài khoản riêng, tạo tối đa 3 không gian học (admin nâng
tối đa 100), thêm các tính năng Flashcards, Sổ tay từ vựng, Sổ ghi nhớ,
Quiz nhanh, Luyện nghe, Đồng hồ học, Mục tiêu học tập và Lịch học.

Repo đích: https://github.com/june97ceo-cpu/laspace.git

## Kiến trúc trên Cloudflare

| Phần | Dịch vụ Cloudflare | Vai trò |
| --- | --- | --- |
| Giao diện | **Pages / Workers Static Assets** | Bản build tĩnh của React app (`frontend/dist`) |
| Máy chủ API | **Workers** | `worker/src/index.ts` — toàn bộ API tại `/api/<action>` |
| Cơ sở dữ liệu | **D1** | Tài khoản, không gian, từ vựng, ghi nhớ, buổi học, mục tiêu, lịch, donate (`schema.sql`) |
| Lưu ảnh | **R2** | Ảnh đại diện người dùng, phục vụ tại `/avatars/<key>` |

Một Worker duy nhất phục vụ cả API và giao diện (cấu hình trong
`wrangler.toml`), nên chỉ cần **một lần deploy** là có link công khai dạng
`https://laspace.<tài-khoản>.workers.dev` — hoặc gắn vào **Cloudflare Pages**
bằng cách trỏ Pages vào cùng repo (build command `npm run build:frontend`,
output `frontend/dist`) và giữ Worker làm API.

Mật khẩu luôn được lưu dạng **PBKDF2 hash có salt** (120.000 vòng, SHA-256)
— giống hệt bản Muse — không bao giờ lưu mật khẩu gốc.

## Cấu trúc thư mục

```
.
├── wrangler.toml          # Bindings: D1 (DB), R2 (AVATARS), static assets
├── schema.sql             # D1 schema đầy đủ (12 bảng) — chạy 1 lần lúc tạo DB
├── package.json           # Scripts: dev / deploy / db:init / r2:create
├── worker/
│   └── src/index.ts       # Worker API: auth, spaces, words, notes,
│                          # sessions, goals, calendar, donations, admin
└── frontend/
    ├── package.json       # Vite + React 19 + Tailwind 4
    ├── vite.config.ts
    ├── index.html
    ├── api.ts             # Transport thay cho Muse SDK: POST /api/<action>
    └── src/               # ← copy từ client/src của bản Muse (xem dưới)
```

## Đưa frontend vào

Thư mục `frontend/src/` lấy nguyên từ bản LaSpace đang chạy trong Muse:

1. Copy toàn bộ `client/src/` (App.tsx, admin.tsx, features.tsx, lib.tsx,
   i18n.ts, settings.tsx, shared.tsx, timer.tsx, toast.tsx, contacts.tsx,
   theme.css, assets/logo.png) vào `frontend/src/`.
2. Thay `frontend/src/api.ts` bằng file `frontend/api.ts` trong gói này
   (đã có sẵn bản sao ở đây — copy đè vào `src/api.ts`).
3. Trong `main.tsx`: bỏ `spaceQueryClient` của `@hatch/space-sdk`, dùng
   `new QueryClient()` từ `@tanstack/react-query`, bỏ class/data-attr của
   SDK và render vào `#root`.
4. Trong `shared.tsx` / các form dùng `FIELDS` (macro của Muse SDK): thay
   bằng thuộc tính thường (`maxLength`, `required`…) — giới hạn từng field
   nằm trong `server/src/actions.ts` của bản Muse.
5. `theme.css`: bỏ dòng `@import "tailwindcss-safe-area"` nếu không cài
   package đó (đã có trong `frontend/package.json` nên giữ nguyên cũng được).

## Các bước deploy (làm 1 lần)

Yêu cầu: tài khoản Cloudflare + Node.js 18+.

```bash
# 0) Lấy mã nguồn
git clone https://github.com/june97ceo-cpu/laspace.git
cd laspace
npm install
npx wrangler login

# 1) Tạo database D1 và bucket R2
npx wrangler d1 create laspace            # copy database_id được in ra
npx wrangler r2 bucket create laspace-avatars

# 2) Dán database_id vào wrangler.toml (thay REPLACE_WITH_D1_ID)

# 3) Tạo bảng trong D1
npm run db:init

# 4) Build giao diện + deploy Worker
npm run deploy
# → Cloudflare in ra link https://laspace.<...>.workers.dev
```

Sau khi deploy, mở link đó: đăng ký tài khoản đầu tiên, rồi tạo tài khoản
Admin bằng cách gọi action `seedAdminAccount` (POST `/api/seedAdminAccount`
với `{name, email, password}`) — chỉ chạy được khi chưa có admin nào.

## Chạy thử ở máy local

```bash
npm run db:init:local   # tạo bảng cho D1 local
npm run dev             # wrangler dev — http://localhost:8787
```

## Cập nhật sau này

```bash
git add -A && git commit -m "update" && git push
npm run deploy
```

Nếu nối repo với Cloudflare Pages (Workers & Pages → Create → Connect to
Git), mỗi lần `git push` Cloudflare tự build lại — link thử nghiệm luôn là
bản mới nhất.

## Ghi chú trung thực

- Gói này được chuẩn bị từ mã nguồn LaSpace đang chạy trong Muse
  (cùng schema, cùng thuật toán băm mật khẩu, cùng tên action). Worker bao
  phủ toàn bộ tính năng người dùng (đăng ký/đăng nhập, không gian, từ vựng
  + flashcards, ghi nhớ, buổi học, mục tiêu, lịch học, donate, ảnh đại
  diện R2) và phần quản trị cốt lõi (tổng quan, bật/tắt donate, giới hạn
  không gian, bật/tắt tính năng, tài khoản ngân hàng, xác nhận donate,
  khóa/đổi vai trò user, cấp mật khẩu tạm, danh sách quên mật khẩu).
- Các action quản trị còn lại của bản Muse (phân quyền chi tiết từng user,
  số liệu nổi bật, mục tiêu gợi ý, liên hệ…) dùng cùng một mẫu
  `app_settings`/`users` — copy thêm từ `server/src/actions.ts` khi cần.
- Việc đẩy mã lên GitHub cần đăng nhập tài khoản GitHub của chủ repo;
  môi trường chuẩn bị mã không có quyền push thay.
