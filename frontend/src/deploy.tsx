import { useState } from "react";
import { Icon, type Lang } from "./lib";
import { tx } from "./i18n";
import { CLOUDFLARE_PACKAGE_FILES } from "./deploy-package";

// Cloudflare deployment centre (admin only): the LaSpace source has been
// prepared as a Cloudflare Pages + Workers + D1 package in the
// `cloudflare/` folder of this project, ready to push to the user's GitHub
// repo. This page is the checklist + the exact commands, so the owner can
// finish the last mile (GitHub push needs their own GitHub login, which
// this environment does not hold).

export const DEPLOY_REPO_URL = "https://github.com/june97ceo-cpu/laspace.git";
export const DEPLOY_REPO_PAGE = "https://github.com/june97ceo-cpu/laspace";

const WRANGLER_TOML = `name = "laspace"
main = "worker/src/index.ts"
compatibility_date = "2025-01-01"

[assets]
directory = "./frontend/dist"
binding = "ASSETS"
not_found_handling = "single-page-application"

[[d1_databases]]
binding = "DB"
database_name = "laspace"
database_id = "951a0597-ed73-44c1-ad5e-3ab8af78e648"`;

const PUSH_COMMANDS = `# Mở terminal ngay trong thư mục vừa giải nén từ laspace-cloudflare.zip
git init
git add -A
git commit -m "LaSpace — Cloudflare Pages + Workers + D1"
git branch -M main
git remote add origin https://github.com/june97ceo-cpu/laspace.git
git push -u origin main`;

// Minimal stored (no-compression) ZIP writer — enough for a bundle of text
// files, built entirely in the browser from the embedded package bytes so
// the download always matches the cloudflare/ folder this build shipped.
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ (bytes[i] ?? 0)) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function fileBytes(file: (typeof CLOUDFLARE_PACKAGE_FILES)[number]): Uint8Array {
  if (file.encoding === "base64") {
    const bin = atob(file.content);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  return new TextEncoder().encode(file.content);
}

function buildPackageZip(): Blob {
  const encoder = new TextEncoder();
  const now = new Date();
  const dosTime = ((now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1)) & 0xffff;
  const dosDate = (((Math.max(0, now.getFullYear() - 1980)) << 9) | ((now.getMonth() + 1) << 5) | now.getDate()) & 0xffff;
  const chunks: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const file of CLOUDFLARE_PACKAGE_FILES) {
    const name = encoder.encode(file.path);
    const data = fileBytes(file);
    const crc = crc32(data);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);
    local.setUint16(6, 0x0800, true); // UTF-8 filenames
    local.setUint16(8, 0, true); // stored
    local.setUint16(10, dosTime, true);
    local.setUint16(12, dosDate, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, data.length, true);
    local.setUint32(22, data.length, true);
    local.setUint16(26, name.length, true);
    chunks.push(new Uint8Array(local.buffer), name, data);
    const entry = new DataView(new ArrayBuffer(46));
    entry.setUint32(0, 0x02014b50, true);
    entry.setUint16(4, 20, true);
    entry.setUint16(6, 20, true);
    entry.setUint16(8, 0x0800, true);
    entry.setUint16(10, 0, true);
    entry.setUint16(12, dosTime, true);
    entry.setUint16(14, dosDate, true);
    entry.setUint32(16, crc, true);
    entry.setUint32(20, data.length, true);
    entry.setUint32(24, data.length, true);
    entry.setUint16(28, name.length, true);
    entry.setUint32(42, offset, true);
    central.push(new Uint8Array(entry.buffer), name);
    offset += 30 + name.length + data.length;
  }
  let centralSize = 0;
  for (const c of central) centralSize += c.length;
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, CLOUDFLARE_PACKAGE_FILES.length, true);
  end.setUint16(10, CLOUDFLARE_PACKAGE_FILES.length, true);
  end.setUint32(12, centralSize, true);
  end.setUint32(16, offset, true);
  return new Blob([...chunks, ...central, new Uint8Array(end.buffer)] as BlobPart[], { type: "application/zip" });
}

function downloadPackageZip() {
  const url = URL.createObjectURL(buildPackageZip());
  const a = document.createElement("a");
  a.href = url;
  a.download = "laspace-cloudflare.zip";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
}

const DEPLOY_COMMANDS = `npm install
npx wrangler login
# Database D1 "laspace" đã tạo sẵn trên Cloudflare, database_id đã điền
# sẵn trong wrangler.toml — không cần tạo lại, không dùng R2.
npm run db:init
npm run deploy`;

function CopyBlock({ label, code }: { label: string; code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="grid gap-1">
      <div className="flex items-center gap-2">
        <span className="flex-1 font-bold">{label}</span>
        <button
          type="button"
          className="btn btn-sm"
          aria-label={`${label}: copy`}
          onClick={() => {
            try {
              void navigator.clipboard?.writeText(code);
            } catch { /* clipboard unavailable */ }
            setCopied(true);
            window.setTimeout(() => setCopied(false), 2000);
          }}
        >
          <Icon name={copied ? "check" : "link"} size={12} /> {copied ? "Đã copy ✓" : "Copy"}
        </button>
      </div>
      <pre
        className="overflow-x-auto rounded-lg border p-2.5"
        style={{ borderColor: "var(--border)", background: "var(--surface2)", fontSize: 11, lineHeight: 1.55, whiteSpace: "pre" }}
      >
        {code}
      </pre>
    </div>
  );
}

const PACKAGE_FILES: { path: string; descVi: string; descEn: string }[] = [
  { path: "cloudflare/README.md", descVi: "Hướng dẫn deploy từng bước (tiếng Việt)", descEn: "Step-by-step deploy guide (Vietnamese)" },
  { path: "cloudflare/wrangler.toml", descVi: "Cấu hình Worker + bindings D1 / Static Assets (database_id thật đã điền sẵn, không có R2)", descEn: "Worker config + D1 / Static Assets bindings (real database_id already filled in, no R2)" },
  { path: "cloudflare/schema.sql", descVi: "Schema D1 đầy đủ: 12 bảng (users, spaces, words, notes, sessions, goals, calendar_events, donations…); ảnh đại diện lưu base64 trong cột users.avatar_data", descEn: "Full D1 schema: 12 tables (users, spaces, words, notes, sessions, goals, calendar_events, donations…); profile pictures stored as base64 in users.avatar_data" },
  { path: "cloudflare/worker/src/index.ts", descVi: "Worker API: toàn bộ /api/<action> — auth PBKDF2, spaces, từ vựng + flashcards, ghi nhớ, buổi học, mục tiêu, lịch học, donate, admin cốt lõi; ảnh đại diện lưu base64 trong D1, phục vụ tại /avatars/<id>", descEn: "Worker API: every /api/<action> — PBKDF2 auth, spaces, vocab + flashcards, notes, sessions, goals, calendar, donations, core admin; avatars stored as base64 in D1, served at /avatars/<id>" },
  { path: "cloudflare/package.json", descVi: "Scripts: dev, deploy, db:init, db:init:local", descEn: "Scripts: dev, deploy, db:init, db:init:local" },
  { path: "cloudflare/frontend/api.ts", descVi: "Transport cho frontend trên Cloudflare: thay Muse SDK bằng POST /api/<action>, kèm fileToBase64 cho upload avatar", descEn: "Frontend transport for Cloudflare: replaces the Muse SDK with POST /api/<action>, plus fileToBase64 for avatar uploads" },
  { path: "cloudflare/frontend/package.json + vite.config.ts + index.html", descVi: "Khung build Vite + React 19 + Tailwind 4", descEn: "Vite + React 19 + Tailwind 4 build shell" },
  { path: "cloudflare/frontend/src/ (đầy đủ)", descVi: "Toàn bộ giao diện đã có sẵn trong gói: copy từ client/src của bản Muse và đã chuyển đổi cho Cloudflare — api.ts dùng POST /api/<action>, main.tsx render vào #root với QueryClient thường (không còn Muse SDK), các form dùng thuộc tính thường thay macro FIELDS. Đã kiểm chứng npm run build:frontend tạo được frontend/dist.", descEn: "The complete UI is already in the package: copied from the Muse build's client/src and adapted for Cloudflare — api.ts posts to /api/<action>, main.tsx renders into #root with a plain QueryClient (no Muse SDK), forms use plain attributes instead of the FIELDS macro. Verified: npm run build:frontend produces frontend/dist." },
];

const ARCH: { icon: "grid" | "gear" | "book" | "layers"; title: string; descVi: string; descEn: string }[] = [
  { icon: "grid", title: "Pages / Static Assets", descVi: "Host giao diện React đã build (frontend/dist) — trang người dùng mở để dùng thử.", descEn: "Hosts the built React UI (frontend/dist) — the page testers open." },
  { icon: "gear", title: "Workers", descVi: "Chạy API /api/<action>: đăng nhập, không gian, từ vựng, donate, admin. Cùng tên action với bản Muse nên frontend chỉ đổi transport.", descEn: "Runs the /api/<action> API: auth, spaces, vocab, donations, admin. Same action names as the Muse build, so the frontend only swaps transport." },
  { icon: "book", title: "D1 — laspace", descVi: "Database SQL lưu tài khoản + dữ liệu học + ảnh đại diện dạng base64 (cột avatar_data). Database đã tạo sẵn trên Cloudflare, nạp bảng bằng schema.sql.", descEn: "SQL database for accounts + learning data + base64 profile pictures (avatar_data column). The database already exists on Cloudflare; initialise it from schema.sql." },
];

const STEPS: { titleVi: string; titleEn: string; descVi: string; descEn: string }[] = [
  { titleVi: "1. Tải file ZIP về, giải nén và đẩy lên GitHub", titleEn: "1. Download the ZIP, unzip it and push to GitHub", descVi: "Bản trên repo hiện là gói cũ chưa có frontend/src nên chưa build chạy được. Bấm nút “Tải gói mã nguồn (.zip)” ở trên để tải gói hoàn chỉnh này (đã gồm frontend/src, build thử thành công) về máy, giải nén, rồi chạy khối lệnh Git ở dưới ngay trong thư mục vừa giải nén (cần đăng nhập GitHub của bạn). Đẩy xong, quay lại Cloudflare bấm Retry build.", descEn: "The version on the repo is the older package without frontend/src, so it cannot build yet. Use the “Download the source package (.zip)” button above to get this complete package (frontend/src included, test-built successfully), unzip it, then run the Git block below from inside the unzipped folder (needs your own GitHub login). After the push, go back to Cloudflare and press Retry build." },
  { titleVi: "2. Database D1 đã sẵn sàng (không dùng R2)", titleEn: "2. The D1 database is ready (no R2)", descVi: "Database “laspace” đã được tạo sẵn trên Cloudflare (Storage & databases → D1). Ảnh đại diện lưu base64 ngay trong D1 nên không cần bucket R2, không cần nhập thẻ.", descEn: "The “laspace” database has already been created on Cloudflare (Storage & databases → D1). Profile pictures are stored as base64 inside D1, so no R2 bucket and no payment card are needed." },
  { titleVi: "3. database_id đã điền sẵn trong wrangler.toml", titleEn: "3. The database_id is already in wrangler.toml", descVi: "ID thật 951a0597-ed73-44c1-ad5e-3ab8af78e648 đã nằm sẵn trong gói này — không còn chỗ REPLACE_WITH_D1_ID nào phải thay.", descEn: "The real id 951a0597-ed73-44c1-ad5e-3ab8af78e648 already ships in this package — there is no REPLACE_WITH_D1_ID left to fill in." },
  { titleVi: "4. Nạp schema vào D1", titleEn: "4. Load the schema into D1", descVi: "Chạy npm run db:init để tạo đủ 12 bảng.", descEn: "Run npm run db:init to create all 12 tables." },
  { titleVi: "5. Deploy", titleEn: "5. Deploy", descVi: "npm run deploy — Cloudflare trả về link dạng laspace.<tài-khoản>.workers.dev. Đó là link gửi cho người dùng thử: họ mở link, đăng ký tài khoản và học ngay.", descEn: "npm run deploy — Cloudflare returns a laspace.<account>.workers.dev link. That is the link to send testers: they open it, register and start learning." },
  { titleVi: "6. Tạo tài khoản Admin đầu tiên", titleEn: "6. Create the first admin account", descVi: "Gọi POST /api/seedAdminAccount với {name, email, password} khi chưa có admin nào — hoặc đăng ký tài khoản đầu tiên rồi nâng quyền trong D1.", descEn: "Call POST /api/seedAdminAccount with {name, email, password} while no admin exists — or register first, then promote the account in D1." },
];

export function DeployView({ lang }: { lang: Lang }) {
  return (
    <div className="grid gap-3">
      <div className="card grid gap-2 p-3" style={{ background: "linear-gradient(120deg, rgba(47,107,255,0.16), rgba(124,58,237,0.16) 55%, rgba(255,138,61,0.16))" }}>
        <p className="font-display text-sm font-bold">{tx(lang, "Gói mã nguồn Cloudflare đã sẵn sàng", "The Cloudflare source package is ready")}</p>
        <p style={{ color: "var(--dim)" }}>
          {tx(lang, "Toàn bộ LaSpace đã được đóng gói lại cho Cloudflare Pages + Workers + D1 trong thư mục cloudflare/ của dự án này (Worker API đầy đủ, schema D1 12 bảng, cấu hình wrangler đã điền sẵn database_id thật, frontend hoàn chỉnh đã build thử thành công ra frontend/dist và README hướng dẫn). Ảnh đại diện lưu base64 trong D1 nên app chạy hoàn toàn miễn phí, không cần R2. Chỉ còn bước đẩy bản mới này lên repo bằng tài khoản GitHub của bạn và bấm deploy là có link công khai cho người dùng thử.", "All of LaSpace has been repackaged for Cloudflare Pages + Workers + D1 in this project's cloudflare/ folder (full Worker API, 12-table D1 schema, wrangler config with the real database_id already filled in, the complete frontend — test-built successfully to frontend/dist — and a README guide). Profile pictures are stored as base64 in D1, so the app runs entirely free with no R2. The only remaining steps are pushing this new version with your own GitHub account and deploying, which produces the public trial link.")}
        </p>
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            className="btn btn-primary btn-lg"
            title={tx(lang, "Tải toàn bộ gói mã nguồn Cloudflare về máy (file .zip)", "Download the whole Cloudflare source package to your device (.zip file)")}
            onClick={downloadPackageZip}
          >
            <Icon name="download" size={13} /> {tx(lang, "Tải gói mã nguồn (.zip)", "Download the source package (.zip)")}
          </button>
          <a className="btn btn-orange" href={DEPLOY_REPO_PAGE} target="_blank" rel="noreferrer">
            <Icon name="link" size={13} /> github.com/june97ceo-cpu/laspace
          </a>
          <span className="chip">{tx(lang, "Repo: đã có bản cũ, chờ push bản hoàn chỉnh này", "Repo: holds the previous version, awaiting this complete one")}</span>
          <span className="chip chip-violet">Pages + Workers + D1</span>
        </div>
        <p style={{ color: "var(--dim)" }}>
          {tx(lang, "File laspace-cloudflare.zip chứa trọn thư mục cloudflare/: wrangler.toml, schema.sql, worker/src/index.ts, frontend/, package.json và README hướng dẫn. Tải về → giải nén → đẩy lên repo bằng khối lệnh Git ở dưới → quay lại Cloudflare bấm Retry build.", "The laspace-cloudflare.zip file contains the complete cloudflare/ folder: wrangler.toml, schema.sql, worker/src/index.ts, frontend/, package.json and the README guide. Download → unzip → push to the repo with the Git block below → back on Cloudflare press Retry build.")}
        </p>
        <div className="grid gap-1">
          <p className="font-bold">
            {tx(lang, `Trong file ZIP có đúng ${CLOUDFLARE_PACKAGE_FILES.length} file (liệt kê từ chính dữ liệu đóng gói):`, `The ZIP contains exactly ${CLOUDFLARE_PACKAGE_FILES.length} files (listed from the packaged data itself):`)}
          </p>
          <div className="flex flex-wrap gap-1">
            {CLOUDFLARE_PACKAGE_FILES.map((f) => (
              <span key={f.path} className={`chip font-mono ${f.path === "wrangler.toml" ? "chip-orange" : ""}`} style={{ fontSize: 10 }}>
                {f.path === "wrangler.toml" ? "✓ " : ""}{f.path} · {(fileBytes(f).length / 1024).toFixed(1)} KB
              </span>
            ))}
          </div>
          <p style={{ color: "var(--dim)" }}>
            {tx(lang, "wrangler.toml nằm ngay ở thư mục gốc của ZIP (đánh dấu ✓ màu cam) — giải nén ra là thấy ngay, không nằm trong thư mục con nào.", "wrangler.toml sits right at the ZIP root (marked ✓ in orange) — unzip and it is immediately visible, not nested in any subfolder.")}
          </p>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {ARCH.map((a) => (
          <div key={a.title} className="card grid gap-1 p-3">
            <p className="font-display flex items-center gap-1.5 font-bold">
              <span style={{ color: "var(--accent)" }}><Icon name={a.icon} size={14} /></span> {a.title}
            </p>
            <p style={{ color: "var(--dim)" }}>{tx(lang, a.descVi, a.descEn)}</p>
          </div>
        ))}
      </div>

      <div className="card grid gap-2 p-3">
        <p className="font-display text-sm font-bold">{tx(lang, "Các bước đưa lên Cloudflare", "Steps to go live on Cloudflare")}</p>
        <div className="grid gap-2">
          {STEPS.map((s) => (
            <div key={s.titleVi} className="grid gap-0.5">
              <p className="font-bold">{tx(lang, s.titleVi, s.titleEn)}</p>
              <p style={{ color: "var(--dim)" }}>{tx(lang, s.descVi, s.descEn)}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="card grid gap-3 p-3">
        <p className="font-display text-sm font-bold">{tx(lang, "Lệnh chạy (copy nguyên khối)", "Commands (copy each block as-is)")}</p>
        <CopyBlock label={tx(lang, "Giải nén xong, đẩy lên repo GitHub", "After unzipping, push to the GitHub repo")} code={PUSH_COMMANDS} />
        <CopyBlock label={tx(lang, "Nạp schema D1 và deploy lên Cloudflare", "Load the D1 schema and deploy to Cloudflare")} code={DEPLOY_COMMANDS} />
        <CopyBlock label="wrangler.toml" code={WRANGLER_TOML} />
      </div>

      <div className="card grid gap-2 p-3">
        <p className="font-display text-sm font-bold">{tx(lang, "Gói mã nguồn gồm những gì", "What the package contains")}</p>
        <div className="grid gap-1.5">
          {PACKAGE_FILES.map((f) => (
            <div key={f.path} className="grid gap-0.5 border-t pt-1.5" style={{ borderColor: "var(--border)" }}>
              <p className="font-mono font-bold" style={{ fontSize: 11 }}>{f.path}</p>
              <p style={{ color: "var(--dim)" }}>{tx(lang, f.descVi, f.descEn)}</p>
            </div>
          ))}
        </div>
        <p style={{ color: "var(--dim)" }}>
          {tx(lang, "Mật khẩu trên Cloudflare vẫn chỉ lưu dạng PBKDF2 hash có salt (120.000 vòng, SHA-256) giống bản Muse — không có mật khẩu gốc nào trong mã nguồn hay database. Worker bao phủ toàn bộ tính năng người dùng và phần quản trị cốt lõi; các action quản trị còn lại dùng cùng mẫu app_settings/users, copy thêm từ server/src/actions.ts khi cần (ghi rõ trong README của gói).", "Passwords on Cloudflare are still stored only as salted PBKDF2 hashes (120,000 rounds, SHA-256), exactly like the Muse build — no plain password exists in the source or the database. The Worker covers every user feature plus core admin; the remaining admin actions follow the same app_settings/users pattern and can be copied from server/src/actions.ts when needed (noted in the package README).")}
        </p>
      </div>
    </div>
  );
}
