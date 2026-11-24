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
    └── src/               # Toàn bộ giao diện, ĐÃ có sẵn trong gói (xem dưới)
        ├── main.tsx       # Render vào #root, QueryClient thường
        ├── api.ts         # = bản sao của frontend/api.ts
        ├── App.tsx, admin.tsx, features.tsx, timer.tsx, settings.tsx,
        ├── lib.tsx, i18n.ts, shared.tsx, toast.tsx, contacts.tsx,
        ├── deploy.tsx, deploy-package.ts, globals.d.ts, theme.css
        └── assets/logo.png
```

## Frontend đã hoàn thiện sẵn trong gói

Thư mục `frontend/src/` đã chứa **toàn bộ** giao diện của bản LaSpace đang
chạy trong Muse, đã được chuyển đổi để chạy độc lập trên Cloudflare — không
cần copy tay nữa:

1. Toàn bộ `client/src/` của bản Muse (App, admin, features, lib, i18n,
   settings, shared, timer, toast, contacts, deploy, theme.css,
   assets/logo.png) đã nằm sẵn trong `frontend/src/`.
2. `frontend/src/api.ts` chính là file `frontend/api.ts`: mọi lời gọi
   `api.<action>(args)` trở thành `POST /api/<action>` tới Worker.
3. `main.tsx` không còn `spaceQueryClient` của `@hatch/space-sdk`: dùng
   `new QueryClient()` từ `@tanstack/react-query`, bỏ class/data-attr của
   SDK và render thẳng vào `#root` (phần tử gốc `.laspace-root` do App tự
   render; safe-area dùng utilities của `tailwindcss-safe-area`).
4. Mọi form dùng macro `FIELDS` của Muse SDK đã được thay bằng thuộc tính
   thường (`maxLength`, `min`, `max`, `required`…) ngay tại từng input,
   đúng giới hạn trong `server/src/actions.ts` của bản Muse.
5. `theme.css` giữ nguyên (kể cả `@import "tailwindcss-safe-area"` — package
   đã có trong `frontend/package.json`).

Đã kiểm chứng: `npm run build:frontend` build thành công ra `frontend/dist`
(index.html + JS + CSS + logo), và `wrangler.toml` trỏ `[assets]` đúng vào
`./frontend/dist`.

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
