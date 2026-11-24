import { useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";
import { BANKS, FEATURES, FEATURE_TEXT, Icon, LANGUAGES, LEARNING_LANGUAGES, fmtDate, fmtDateTime, fmtMoney, t, type AdminData, type AdminSectionId, type IconName, type Lang } from "./lib";
import { permDesc, permName, roleName, tx, txf } from "./i18n";
import { ConfirmDialog } from "./shared";
import { ContactIcon, PLATFORM_PRESETS } from "./contacts";
import { goalStatus, goalTitle } from "./timer";
import { DeployView } from "./deploy";

// Per-user permission catalog. Admins hold all of these implicitly; the
// presets mirror common staff roles (accountant, content, customer care).
export const PERMISSIONS: { key: string; vi: string; en: string; descVi: string; descEn: string }[] = [
  { key: "users", vi: "Quản lý người dùng", en: "Manage users", descVi: "Xem thông tin đăng nhập & cá nhân của user, khóa / mở khóa, nâng cấp số không gian", descEn: "View users' login & personal info, lock / unlock, upgrade space limits" },
  { key: "finance", vi: "Tài chính & Donate", en: "Finance & donations", descVi: "Xem báo cáo donate, xác nhận và xóa các giao dịch donate, cập nhật tài khoản nhận donate để tạo mã QR", descEn: "View the donation report, confirm and delete donation transactions, update the receiving bank account for QR codes" },
  { key: "content", vi: "Quản lý nội dung", en: "Manage content", descVi: "Thêm / xóa link liên hệ", descEn: "Add / remove contact links" },
  { key: "system", vi: "Cài đặt hệ thống", en: "System settings", descVi: "Bật / tắt tính năng toàn hệ thống, đặt giới hạn không gian chung", descEn: "Toggle features system-wide, set the global space limit" },
];

export const ROLE_PRESETS: { id: string; vi: string; en: string; perms: string[] }[] = [
  { id: "accountant", vi: "Kế toán", en: "Accountant", perms: ["finance"] },
  { id: "content", vi: "Content", en: "Content", perms: ["content"] },
  { id: "support", vi: "Chăm sóc khách hàng", en: "Customer care", perms: ["users"] },
];

type AdminUserItem = AdminData["users"][number];

export function UserInfoGrid({ lang, u }: { lang: Lang; u: AdminUserItem }) {
  const L = lang === "vi";
  const rows: { label: string; value: string }[] = [
    { label: tx(lang, "Email đăng nhập", "Login email"), value: u.email },
    { label: tx(lang, "Đăng nhập gần nhất", "Last login"), value: u.lastLoginAt ? fmtDateTime(u.lastLoginAt, lang) : "—" },
    { label: tx(lang, "Số điện thoại", "Phone"), value: u.phone || "—" },
    { label: tx(lang, "Ngày sinh", "Date of birth"), value: u.birthDate ? fmtDate(u.birthDate, lang) : u.birthYear ? String(u.birthYear) : "—" },
    { label: tx(lang, "Giới tính", "Gender"), value: u.gender || "—" },
    { label: tx(lang, "Ngôn ngữ", "Language"), value: LANGUAGES.find((x) => x.code === u.language)?.label ?? u.language },
    { label: tx(lang, "Ngôn ngữ mẹ đẻ", "Native language"), value: u.nativeLanguage ? (LANGUAGES.find((x) => x.code === u.nativeLanguage)?.label ?? u.nativeLanguage) : "—" },
    { label: tx(lang, "Ngôn ngữ bạn đang học", "Language you are learning"), value: u.learningLanguage ? (LEARNING_LANGUAGES.find((x) => x.code === u.learningLanguage)?.label ?? u.learningLanguage) : "—" },
    { label: tx(lang, "Giao diện", "Theme"), value: u.theme === "light" ? (tx(lang, "Sáng", "Light")) : u.theme === "system" ? (tx(lang, "Theo hệ thống", "System")) : (tx(lang, "Tối", "Dark")) },
    { label: "Google Sheet", value: u.sheetConnected ? (tx(lang, "Đã kết nối", "Connected")) : (tx(lang, "Chưa kết nối", "Not connected")) },
    { label: tx(lang, "Ngày tạo tài khoản", "Account created"), value: fmtDateTime(u.createdAt, lang) },
  ];
  return (
    <div className="grid gap-x-3 gap-y-1 border-t pt-1.5 sm:grid-cols-2" style={{ borderColor: "var(--border)" }}>
      {rows.map((r) => (
        <p key={r.label} className="flex min-w-0 gap-1.5">
          <span className="shrink-0" style={{ color: "var(--dim)" }}>{r.label}:</span>
          <span className="min-w-0 truncate font-semibold">{r.value}</span>
        </p>
      ))}
      <p style={{ color: "var(--dim)" }}>
        {tx(lang, "Mật khẩu được mã hóa ở máy chủ nên không xem được.", "Passwords are hashed server-side and cannot be viewed.")}
      </p>
    </div>
  );
}

export function PermissionsEditor({
  lang,
  value,
  onChange,
}: {
  lang: Lang;
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const L = lang === "vi";
  const presetId = value.length === 0
    ? "none"
    : ROLE_PRESETS.find((p) => p.perms.length === value.length && p.perms.every((k) => value.includes(k)))?.id ?? "custom";
  return (
    <div className="grid gap-1.5 border-t pt-1.5" style={{ borderColor: "var(--border)" }}>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="font-bold">{tx(lang, "Quyền của user này", "This user's permissions")}</span>
        <select
          className="input ml-auto"
          style={{ width: 170 }}
          value={presetId}
          onChange={(e) => {
            const id = e.target.value;
            if (id === "none") onChange([]);
            else if (id !== "custom") onChange([...(ROLE_PRESETS.find((p) => p.id === id)?.perms ?? [])]);
          }}
          aria-label={tx(lang, "Chọn vai trò mẫu", "Pick a role preset")}
        >
          <option value="none">{tx(lang, "Không có quyền thêm", "No extra permissions")}</option>
          {ROLE_PRESETS.map((p) => (
            <option key={p.id} value={p.id}>{txf(lang, "Vai trò: {0}", "Role: {0}", roleName(lang, p.id))}</option>
          ))}
          <option value="custom">{tx(lang, "Tùy chỉnh", "Custom")}</option>
        </select>
      </div>
      <div className="grid gap-1 sm:grid-cols-2">
        {PERMISSIONS.map((p) => {
          const on = value.includes(p.key);
          return (
            <label key={p.key} className="flex cursor-pointer items-start gap-1.5">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 shrink-0"
                checked={on}
                onChange={(e) => onChange(e.target.checked ? [...value, p.key] : value.filter((k) => k !== p.key))}
              />
              <span>
                <span className="font-semibold">{permName(lang, p.key)}</span>
                <span className="block" style={{ color: "var(--dim)" }}>{permDesc(lang, p.key)}</span>
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

function AdminSection({
  title,
  badge,
  open,
  onToggle,
  children,
}: {
  title: string;
  badge?: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div className="card">
      <button
        type="button"
        className="flex w-full items-center gap-2 p-3 text-left"
        onClick={onToggle}
        aria-expanded={open}
      >
        <span className="font-display flex-1 text-sm font-bold">{title}</span>
        {badge ? <span className="chip chip-orange">{badge}</span> : null}
        <Icon name={open ? "chevD" : "chevR"} size={14} />
      </button>
      {open ? <div className="grid gap-2 px-3 pb-3">{children}</div> : null}
    </div>
  );
}

export type BankDraft = { bank: string; bankBin: string; account: string; holder: string };

// Bank account form: picking a bank stores its VietQR BIN code, which is
// what lets the app generate donation QR codes with the amount and the
// transaction code pre-filled.
export function BankInfoForm({
  lang,
  value,
  saved,
  justSaved,
  saveError,
  onDismissSaved,
  onChange,
  onSave,
  saving,
}: {
  lang: Lang;
  value: BankDraft;
  saved: BankDraft;
  justSaved: boolean;
  saveError: string;
  onDismissSaved: () => void;
  onChange: (next: BankDraft) => void;
  onSave: () => void;
  saving: boolean;
}) {
  const L = lang === "vi";
  return (
    <div className="grid gap-1.5 border rounded-lg p-2" style={{ borderColor: "var(--border)" }}>
      <p className="font-bold">{tx(lang, "Tài khoản nhận donate (để tạo mã QR)", "Donation bank account (for QR codes)")}</p>
      <p style={{ color: "var(--dim)" }}>
        {tx(lang, "Chọn đúng ngân hàng để app tự tạo mã QR VietQR: khách quét mã là số tiền và mã giao dịch đã điền sẵn, chỉ cần bấm chuyển.", "Pick the right bank so the app can build a VietQR code: the donor scans it and the amount plus transaction code are already filled in.")}
      </p>
      <div className="grid gap-1.5 sm:grid-cols-2">
        <label className="block">
          <span style={{ color: "var(--dim)" }}>{tx(lang, "Ngân hàng", "Bank")}</span>
          <select
            className="input"
            value={value.bankBin}
            onChange={(e) => {
              const b = BANKS.find((x) => x.bin === e.target.value);
              onChange({ ...value, bankBin: e.target.value, bank: b?.name ?? value.bank });
            }}
            aria-label={tx(lang, "Ngân hàng", "Bank")}
          >
            <option value="">{tx(lang, "— Chọn ngân hàng —", "— Pick a bank —")}</option>
            {BANKS.map((b) => (
              <option key={b.bin} value={b.bin}>{b.name}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span style={{ color: "var(--dim)" }}>{tx(lang, "Tên hiển thị ngân hàng", "Bank display name")}</span>
          <input maxLength={80} className="input" value={value.bank} onChange={(e) => onChange({ ...value, bank: e.target.value })} placeholder="Vietcombank…" />
        </label>
        <label className="block">
          <span style={{ color: "var(--dim)" }}>{tx(lang, "Số tài khoản", "Account number")}</span>
          <input maxLength={40} className="input" value={value.account} onChange={(e) => onChange({ ...value, account: e.target.value })} />
        </label>
        <label className="block">
          <span style={{ color: "var(--dim)" }}>{tx(lang, "Chủ tài khoản", "Account holder")}</span>
          <input maxLength={80} className="input" value={value.holder} onChange={(e) => onChange({ ...value, holder: e.target.value })} />
        </label>
      </div>
      <div>
        <button type="button" className="btn btn-orange" disabled={saving} onClick={onSave}>
          {t(lang, "save")}
        </button>
      </div>
      {saveError ? <p style={{ color: "var(--bad)" }}>{saveError}</p> : null}
      {justSaved ? (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border px-2.5 py-2"
          style={{ borderColor: "var(--good)", background: "color-mix(in srgb, var(--good) 12%, transparent)" }}
        >
          <span
            className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-white"
            style={{ background: "var(--good)" }}
          >
            <Icon name="check" size={12} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-bold" style={{ color: "var(--good)" }}>
              {tx(lang, "Lưu thành công!", "Saved successfully!")}
            </p>
            <p style={{ color: "var(--dim)" }}>
              {tx(lang, "Thông tin tài khoản nhận donate đã được cập nhật. Mã QR VietQR cho khách sẽ dùng ngay thông tin mới này.", "The donation bank account has been updated. Donor VietQR codes now use this new information.")}
            </p>
          </div>
          <button
            type="button"
            className="btn btn-sm btn-ghost shrink-0"
            onClick={onDismissSaved}
            aria-label={tx(lang, "Đóng thông báo", "Dismiss notification")}
          >
            <Icon name="x" size={12} />
          </button>
        </div>
      ) : null}
      {saved.account ? (
        <div className="grid gap-1 rounded-lg border px-2.5 py-2" style={{ borderColor: "var(--border)", background: "var(--surface2)" }}>
          <p className="font-bold">{tx(lang, "Thông tin tài khoản đã lưu", "Saved bank account")}</p>
          <div className="grid gap-0.5 sm:grid-cols-3" style={{ color: "var(--dim)" }}>
            <span>{tx(lang, "Ngân hàng", "Bank")}: <b style={{ color: "var(--text)" }}>{saved.bank || "—"}</b></span>
            <span>{tx(lang, "Số tài khoản", "Account number")}: <b style={{ color: "var(--text)" }}>{saved.account}</b></span>
            <span>{tx(lang, "Chủ tài khoản", "Account holder")}: <b style={{ color: "var(--text)" }}>{saved.holder || "—"}</b></span>
          </div>
        </div>
      ) : null}
    </div>
  );
}

type DonationRow = AdminData["donations"][number];

// Donation transactions with search by code / donor and a date range, each
// row showing the full date and time it was created.
export function DonationList({
  lang,
  donations,
  onConfirm,
  onDelete,
  busy,
}: {
  lang: Lang;
  donations: DonationRow[];
  onConfirm: (id: number) => void;
  onDelete: (id: number) => void;
  busy: boolean;
}) {
  const L = lang === "vi";
  const [query, setQuery] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return donations.filter((d) => {
      if (q && !d.donorName.toLowerCase().includes(q) && !d.code.toLowerCase().includes(q)) return false;
      const day = d.createdAt.slice(0, 10);
      if (from && day < from) return false;
      if (to && day > to) return false;
      return true;
    });
  }, [donations, query, from, to]);

  return (
    <div className="grid gap-1.5">
      <div className="flex flex-wrap items-end gap-1.5">
        <label className="block min-w-40 flex-1">
          <span style={{ color: "var(--dim)" }}>{tx(lang, "Tìm giao dịch (mã / người donate)", "Search transactions (code / donor)")}</span>
          <input className="input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="LS-…" aria-label={tx(lang, "Tìm giao dịch", "Search transactions")} />
        </label>
        <label className="block">
          <span style={{ color: "var(--dim)" }}>{tx(lang, "Từ ngày", "From")}</span>
          <input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} aria-label={tx(lang, "Từ ngày", "From date")} />
        </label>
        <label className="block">
          <span style={{ color: "var(--dim)" }}>{tx(lang, "Đến ngày", "To")}</span>
          <input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} aria-label={tx(lang, "Đến ngày", "To date")} />
        </label>
        {(query || from || to) ? (
          <button type="button" className="btn btn-sm" onClick={() => { setQuery(""); setFrom(""); setTo(""); }}>
            {tx(lang, "Xóa lọc", "Clear")}
          </button>
        ) : null}
      </div>
      <div className="grid gap-1">
        {shown.map((d) => (
          <div key={d.id} className="flex flex-wrap items-center gap-2 border-t py-1.5" style={{ borderColor: "var(--border)" }}>
            <span className="font-bold">{d.donorName}</span>
            <span className="font-display font-extrabold" style={{ color: "var(--accent)" }}>{fmtMoney(d.amount)}</span>
            {d.code ? <span className="chip">{d.code}</span> : null}
            <span className={`chip ${d.status === "confirmed" ? "chip-violet" : "chip-orange"}`}>
              {d.status === "confirmed" ? (tx(lang, "Đã nhận", "Received")) : (tx(lang, "Chờ xác nhận", "Pending"))}
            </span>
            {d.note ? <span style={{ color: "var(--dim)" }}>{d.note}</span> : null}
            <span style={{ color: "var(--dim)" }}>{fmtDateTime(d.createdAt, lang)}</span>
            <span className="ml-auto flex gap-1.5">
              {d.status === "pending" ? (
                <button
                  type="button"
                  className="btn btn-sm btn-orange"
                  disabled={busy}
                  onClick={() => onConfirm(d.id)}
                >
                  <Icon name="check" size={12} /> {tx(lang, "Xác nhận đã nhận", "Confirm received")}
                </button>
              ) : null}
              <button
                type="button"
                className="btn btn-sm btn-danger"
                disabled={busy}
                onClick={() => onDelete(d.id)}
                aria-label={`${t(lang, "delete")}: ${d.code || d.donorName} ${fmtMoney(d.amount)}`}
              >
                <Icon name="trash" size={12} />
              </button>
            </span>
          </div>
        ))}
        {shown.length === 0 ? (
          <p style={{ color: "var(--dim)" }}>
            {donations.length === 0
              ? (tx(lang, "Chưa có khoản donate nào.", "No donations yet."))
              : (tx(lang, "Không có giao dịch nào khớp bộ lọc.", "No transactions match the filter."))}
          </p>
        ) : null}
      </div>
    </div>
  );
}

// The admin area is split into separate pages: "dashboard" shows system
// data only, and every operation lives on its own page, linked from the
// app's main sidebar (QUẢN TRỊ group).
export type AdminPage = "dashboard" | AdminSectionId;

export function adminNavItems(
  lang: Lang,
  data: AdminData,
  resetsCount: number,
): { id: AdminSectionId; label: string; hint: string; icon: IconName; badge?: string }[] {
  return [
    { id: "rules", label: tx(lang, "Rule phân quyền", "Permission rules"), hint: tx(lang, "Admin có quyền gì, user được cấp quyền làm được gì", "What admins and permitted users can do"), icon: "shield" },
    { id: "system", label: tx(lang, "Cài đặt hệ thống", "System settings"), hint: tx(lang, "Giới hạn không gian, số liệu nổi bật, mục tiêu gợi ý và bật/tắt tính năng", "Space limit, showcase numbers, suggested goals and feature toggles"), icon: "gear" },
    {
      id: "donate",
      label: "Donate",
      hint: tx(lang, "Tài khoản nhận donate, mã QR và các giao dịch chờ xác nhận", "Receiving bank account, QR codes and pending transactions"),
      icon: "heart",
      badge: `${fmtMoney(data.stats.donateTotal)} · ${data.stats.donateCount}${data.stats.donatePendingCount ? ` · ${data.stats.donatePendingCount} ${tx(lang, "chờ", "pending")}` : ""}`,
    },
    { id: "password", label: tx(lang, "Mật khẩu Admin", "Admin password"), hint: tx(lang, "Đổi mật khẩu cho chính tài khoản Admin này", "Change this admin account's own password"), icon: "lock" },
    {
      id: "resets",
      label: tx(lang, "Quên mật khẩu", "Password resets"),
      hint: tx(lang, "Yêu cầu quên mật khẩu của user và cấp mật khẩu tạm", "Users' forgot-password requests and temporary passwords"),
      icon: "help",
      badge: resetsCount ? String(resetsCount) : undefined,
    },
    {
      id: "contacts",
      label: tx(lang, "Liên hệ & mạng xã hội", "Contact & social links"),
      hint: tx(lang, "Link Zalo, Telegram, Facebook… hiện ở màn hình chào và chân trang", "Zalo, Telegram, Facebook… links shown on the welcome screen and footer"),
      icon: "link",
      badge: data.contacts.length ? String(data.contacts.length) : undefined,
    },
    { id: "users", label: tx(lang, "Quản lý người dùng", "User management"), hint: tx(lang, "Xem thông tin user, cấp quyền, nâng cấp không gian, xem và xóa tài khoản", "View user info, grant permissions, upgrade spaces, view and delete accounts"), icon: "users", badge: String(data.users.length) },
    { id: "deploy", label: tx(lang, "Triển khai Cloudflare", "Cloudflare deployment"), hint: tx(lang, "Gói mã nguồn Pages + Workers + D1 + R2, repo GitHub và các bước tạo link cho người dùng thử", "Pages + Workers + D1 + R2 source package, the GitHub repo and the steps to a public trial link"), icon: "link", badge: "GitHub" },
  ];
}

export function AdminDashboard({
  token,
  lang,
  selfId,
  onViewUser,
  page,
}: {
  token: string;
  lang: Lang;
  selfId: number;
  onViewUser: (userId: number) => void;
  page: AdminPage;
}) {
  const L = lang === "vi";
  const queryClient = useQueryClient();
  const adminQ = useQuery({ queryKey: ["admin"], queryFn: () => api.adminOverview({ token }) });
  const section: AdminPage = page;
  const [confirmRole, setConfirmRole] = useState<{ id: number; name: string; role: "user" | "admin" } | null>(null);
  const [maxSpacesDraft, setMaxSpacesDraft] = useState<number | null>(null);
  const [spaceDrafts, setSpaceDrafts] = useState<Record<number, string>>({});
  const [expandedUser, setExpandedUser] = useState<number | null>(null);
  const [permDrafts, setPermDrafts] = useState<Record<number, string[]>>({});
  const [bankDraft, setBankDraft] = useState<BankDraft | null>(null);
  const [bankSaved, setBankSaved] = useState(false);
  const [bankError, setBankError] = useState("");
  const [showcaseDrafts, setShowcaseDrafts] = useState<{ users: string; fiveStar: string; downloads: string } | null>(null);
  const [goalDrafts, setGoalDrafts] = useState<{ type: "minutes" | "words" | "sessions"; target: string; labelVi: string; labelEn: string }[] | null>(null);
  const [goalError, setGoalError] = useState("");
  const [confirmDeleteUser, setConfirmDeleteUser] = useState<{ id: number; name: string; email: string } | null>(null);
  const [confirmResetPw, setConfirmResetPw] = useState<{ id: number; name: string } | null>(null);
  const [resetPwResult, setResetPwResult] = useState<{ id: number; name: string; email: string; pw: string } | null>(null);
  // admin password: typed in the admin account first, then sent to the
  // server, which stores only a salted hash.
  const [pwCurrent, setPwCurrent] = useState("");
  const [pwNew, setPwNew] = useState("");
  const [pwConfirm, setPwConfirm] = useState("");
  const [pwError, setPwError] = useState("");
  const [pwDone, setPwDone] = useState(false);

  // contact form
  const [ctPlatform, setCtPlatform] = useState("");
  const [ctUrl, setCtUrl] = useState("");
  const [ctError, setCtError] = useState("");

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["admin"] });
    queryClient.invalidateQueries({ queryKey: ["public-info"] });
    // The signed-in user's own limits/flags come from ["me"] — refresh it too
    // so an upgrade (e.g. max spaces) shows everywhere immediately.
    queryClient.invalidateQueries({ queryKey: ["me"] });
  };
  const setRole = useMutation({
    mutationFn: (args: { id: number; role: "user" | "admin" }) => api.adminSetUserRole({ token, userId: args.id, role: args.role }),
    onSuccess: () => { invalidate(); setConfirmRole(null); },
  });
  const setLocked = useMutation({
    mutationFn: (args: { id: number; locked: boolean }) => api.adminSetUserLocked({ token, userId: args.id, locked: args.locked }),
    onSuccess: invalidate,
  });
  const setMaxSpaces = useMutation({
    mutationFn: (value: number) => api.adminSetMaxSpaces({ token, value }),
    onSuccess: invalidate,
  });
  const setUserMaxSpaces = useMutation({
    mutationFn: (args: { id: number; value: number | null }) =>
      api.adminSetUserMaxSpaces({ token, userId: args.id, value: args.value }),
    onSuccess: invalidate,
  });
  const setFlag = useMutation({
    mutationFn: (args: { key: string; enabled: boolean }) =>
      api.adminSetFeatureFlag({ token, featureKey: args.key as "flashcards", enabled: args.enabled }),
    onSuccess: invalidate,
  });
  const deleteDonation = useMutation({
    mutationFn: (id: number) => api.adminDeleteDonation({ token, donationId: id }),
    onSuccess: invalidate,
  });
  const setDonateEnabled = useMutation({
    mutationFn: (enabled: boolean) => api.adminSetDonateEnabled({ token, enabled }),
    onSuccess: invalidate,
  });
  const setDonationStatus = useMutation({
    mutationFn: (args: { id: number; status: "pending" | "confirmed" }) =>
      api.adminSetDonationStatus({ token, donationId: args.id, status: args.status }),
    onSuccess: invalidate,
  });
  const deleteUser = useMutation({
    mutationFn: (id: number) => api.adminDeleteUser({ token, userId: id }),
    onSuccess: () => { invalidate(); setConfirmDeleteUser(null); },
  });
  // Safe password reset: the server generates a temporary password, stores
  // only its salted hash and revokes the user's sessions; the plain temp
  // password is shown here exactly once for the admin to relay. The user's
  // own password is never stored or shown anywhere.
  const resetUserPassword = useMutation({
    mutationFn: (id: number) => api.adminIssueTempPassword({ token, userId: id }),
    onSuccess: (r, id) => { setResetPwResult({ id, name: r.userName, email: r.email, pw: r.tempPassword }); setConfirmResetPw(null); },
  });
  const changeAdminPassword = useMutation({
    mutationFn: () => api.changePassword({ token, currentPassword: pwCurrent, newPassword: pwNew }),
    onSuccess: () => { setPwCurrent(""); setPwNew(""); setPwConfirm(""); setPwError(""); setPwDone(true); },
    onError: (e) => { setPwDone(false); setPwError(e.message); },
  });
  const setPermissions = useMutation({
    mutationFn: (args: { id: number; permissions: string[] }) =>
      api.adminSetUserPermissions({ token, userId: args.id, permissions: args.permissions as "users"[] }),
    onSuccess: invalidate,
  });
  const setBankInfo = useMutation({
    mutationFn: (b: BankDraft) => api.adminSetBankInfo({ token, ...b }),
    onSuccess: () => { invalidate(); setBankDraft(null); setBankError(""); setBankSaved(true); },
    onError: (e) => { setBankSaved(false); setBankError(e.message); },
  });
  const setShowcase = useMutation({
    mutationFn: (v: { users: number | null; fiveStar: number | null; downloads: number | null }) =>
      api.adminSetShowcaseStats({ token, ...v }),
    onSuccess: invalidate,
  });
  const setGoalOptions = useMutation({
    mutationFn: (options: { type: "minutes" | "words" | "sessions"; target: number; labelVi: string; labelEn: string }[]) =>
      api.adminSetGoalOptions({ token, options }),
    onSuccess: () => { invalidate(); setGoalDrafts(null); setGoalError(""); },
    onError: (e) => setGoalError(e.message),
  });
  const addContact = useMutation({
    mutationFn: () => api.adminAddContact({ token, platform: ctPlatform.trim(), url: ctUrl.trim() }),
    onSuccess: () => { invalidate(); setCtPlatform(""); setCtUrl(""); setCtError(""); },
    onError: (e) => setCtError(e.message),
  });
  const deleteContact = useMutation({
    mutationFn: (id: string) => api.adminDeleteContact({ token, contactId: id }),
    onSuccess: invalidate,
  });

  // Forgot-password requests filed from the login screen.
  const resetsQ = useQuery({ queryKey: ["password-resets"], queryFn: () => api.adminListPasswordResets({ token }) });
  const [tempPw, setTempPw] = useState<{ userName: string; email: string; tempPassword: string } | null>(null);
  const issueTempPw = useMutation({
    mutationFn: (userId: number) => api.adminIssueTempPassword({ token, userId }),
    onSuccess: (r) => {
      setTempPw(r);
      queryClient.invalidateQueries({ queryKey: ["password-resets"] });
    },
  });

  const data = adminQ.data;
  if (adminQ.isPending) return <p style={{ color: "var(--dim)" }}>{tx(lang, "Đang tải…", "Loading…")}</p>;
  if (!data) return <p style={{ color: "var(--bad)" }}>{tx(lang, "Không tải được dữ liệu quản trị.", "Could not load admin data.")}</p>;

  const statCards: { label: string; value: string }[] = [
    { label: tx(lang, "Người dùng", "Users"), value: String(data.stats.users) },
    { label: tx(lang, "Không gian", "Spaces"), value: String(data.stats.spaces) },
    { label: tx(lang, "Từ vựng", "Words"), value: String(data.stats.words) },
    { label: tx(lang, "Buổi học", "Sessions"), value: String(data.stats.sessions) },
    { label: tx(lang, "Tổng donate đã nhận", "Donations received"), value: fmtMoney(data.stats.donateTotal) },
    {
      label: tx(lang, "Donate chờ xác nhận", "Pending donations"),
      value: String(data.stats.donatePendingCount),
    },
  ];

  // Section metadata (labels, hints, badges) is shared with the main
  // sidebar, which now links to each admin page directly.
  const adminNav = adminNavItems(lang, data, resetsQ.data?.requests.length ?? 0);
  const sectionTitle = section === "dashboard"
    ? "Dashboard Admin"
    : (adminNav.find((i) => i.id === section)?.label ?? "Dashboard Admin");

  return (
    <div className="grid gap-3">
      <h2 className="font-display text-base font-extrabold">{sectionTitle}</h2>

      {section === "dashboard" ? (
        <>
          {/* The dashboard shows system data only — every operation lives
              on its own page in the main sidebar. */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {statCards.map((s) => (
              <div key={s.label} className="card p-2.5 text-center">
                <p className="font-display text-lg font-extrabold">{s.value}</p>
                <p style={{ color: "var(--dim)" }}>{s.label}</p>
              </div>
            ))}
          </div>
          <div className="card grid gap-1 p-3">
            <p className="font-display text-sm font-bold">{tx(lang, "Dữ liệu hệ thống", "System data")}</p>
            <p style={{ color: "var(--dim)" }}>
              {txf(lang, "LaSpace hiện có {0} người dùng, {1} không gian học, {2} từ vựng và {3} buổi học đã ghi lại.", "LaSpace currently holds {0} users, {1} learning spaces, {2} words and {3} recorded study sessions.", data.stats.users, data.stats.spaces, data.stats.words, data.stats.sessions)}
            </p>
            <p style={{ color: "var(--dim)" }}>
              {txf(lang, "Donate: {0} đã nhận từ {1} giao dịch, {2} giao dịch đang chờ xác nhận. Các thao tác quản trị nằm ở từng mục riêng trong thanh bên (nhóm Quản trị).", "Donations: {0} received across {1} transactions, {2} still pending confirmation. Admin operations live in their own items in the sidebar (Admin group).", fmtMoney(data.stats.donateTotal), data.stats.donateCount, data.stats.donatePendingCount)}
            </p>
          </div>
        </>
      ) : (
        <div className="grid min-w-0 gap-3">
          {section === "deploy" ? <DeployView lang={lang} /> : null}

          {section === "rules" ? (
            <div className="card grid gap-2 p-3">
              <h3 className="font-display text-sm font-bold">{tx(lang, "Rule phân quyền", "Permission rules")}</h3>
        <p><b>Admin:</b> {tx(lang, "có toàn quyền — quản lý người dùng, cấp quyền cho từng user, bật/tắt tính năng toàn hệ thống, đặt giới hạn không gian (tối đa 100), nâng cấp số không gian cho từng user, xem và thao tác toàn bộ không gian của user, xóa tài khoản user, quản lý giao dịch donate và link liên hệ.", "full access — manages users, grants per-user permissions, toggles features system-wide, sets the space limit (max 100), upgrades individual users' space limits, views and manages all of a user's spaces, deletes user accounts, manages donation transactions and contact links.")}</p>
        <p><b>{tx(lang, "User được cấp quyền", "Permitted user")}:</b> {tx(lang, "mở từng user trong mục Quản lý người dùng để tick quyền cho họ (hoặc chọn nhanh vai trò Kế toán / Content / Chăm sóc khách hàng). User được cấp quyền sẽ thấy mục “Khu vực được phân quyền” với đúng phần việc của mình.", "open a user under User management to tick their permissions (or pick the Accountant / Content / Customer care preset). A permitted user sees a “Your granted area” section with exactly their slice of work.")}</p>
        <div className="grid gap-1">
          {PERMISSIONS.map((p) => (
            <p key={p.key}><b>{permName(lang, p.key)}:</b> <span style={{ color: "var(--dim)" }}>{permDesc(lang, p.key)}</span></p>
          ))}
        </div>
        <p><b>{tx(lang, "Người dùng thường", "Regular user")}:</b> {tx(lang, "chỉ thấy và dùng không gian của chính mình; không thấy bất kỳ mục quản trị nào.", "sees and uses only their own spaces; never sees any admin area.")}</p>
            </div>
          ) : null}

          {section === "system" ? (
            <div className="card grid gap-2 p-3">
              <h3 className="font-display text-sm font-bold">{tx(lang, "Cài đặt hệ thống", "System settings")}</h3>
        <label className="flex items-center gap-2">
          <span className="flex-1" style={{ color: "var(--dim)" }}>{tx(lang, "Số không gian tối đa mỗi người dùng", "Max spaces per user")}</span>
          <input
            min={1} max={100}
            type="number"
            className="input"
            style={{ width: 64 }}
            value={maxSpacesDraft ?? data.maxSpaces}
            onChange={(e) => setMaxSpacesDraft(Number(e.target.value))}
            aria-label={tx(lang, "Số không gian tối đa", "Max spaces")}
          />
          <button type="button" className="btn btn-orange" disabled={setMaxSpaces.isPending} onClick={() => setMaxSpaces.mutate(maxSpacesDraft ?? data.maxSpaces)}>
            {t(lang, "save")}
          </button>
        </label>
        <div className="grid gap-1">
          {FEATURES.map((f) => {
            const enabled = data.featureFlags[f.key] !== false;
            return (
              <label key={f.key} className="flex min-h-7 cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={enabled}
                  onChange={(e) => setFlag.mutate({ key: f.key, enabled: e.target.checked })}
                />
                <Icon name={f.icon} size={13} />
                <span className="flex-1 font-semibold">{FEATURE_TEXT[f.key]?.name[lang]}</span>
                <span style={{ color: enabled ? "var(--good)" : "var(--dim)" }}>{enabled ? (tx(lang, "Đang bật", "On")) : (tx(lang, "Đang tắt", "Off"))}</span>
              </label>
            );
          })}
        </div>
        <div className="grid gap-1.5 border-t pt-2" style={{ borderColor: "var(--border)" }}>
          <p className="font-bold">{tx(lang, "Số liệu nổi bật ở màn hình chào", "Welcome-screen headline numbers")}</p>
          <p style={{ color: "var(--dim)" }}>
            {tx(lang, "Ba con số lớn ở màn hình chào (người dùng, đánh giá 5 sao, lượt tải). Để trống ô nào thì app tự dùng số thật của ô đó.", "The three big numbers on the welcome screen (users, five-star reviews, downloads). Leave a field empty to use the real count.")}
          </p>
          <div className="grid gap-1.5 sm:grid-cols-3">
            {(
              [
                { key: "users", label: tx(lang, "Người dùng", "Users"), current: data.showcase.users, real: data.stats.users },
                { key: "fiveStar", label: tx(lang, "Đánh giá 5 sao", "Five-star reviews"), current: data.showcase.fiveStar, real: null },
                { key: "downloads", label: tx(lang, "Lượt tải", "Downloads"), current: data.showcase.downloads, real: null },
              ] as const
            ).map((f) => (
              <label key={f.key} className="block">
                <span style={{ color: "var(--dim)" }}>{f.label}</span>
                <input
                  type="number"
                  min={0}
                  className="input"
                  value={showcaseDrafts?.[f.key] ?? (f.current != null ? String(f.current) : "")}
                  placeholder={f.real != null ? `${tx(lang, "Số thật", "Real")}: ${f.real}` : (tx(lang, "Chưa đặt", "Not set"))}
                  onChange={(e) =>
                    setShowcaseDrafts((d) => ({
                      users: d?.users ?? (data.showcase.users != null ? String(data.showcase.users) : ""),
                      fiveStar: d?.fiveStar ?? (data.showcase.fiveStar != null ? String(data.showcase.fiveStar) : ""),
                      downloads: d?.downloads ?? (data.showcase.downloads != null ? String(data.showcase.downloads) : ""),
                      [f.key]: e.target.value,
                    }))
                  }
                  aria-label={f.label}
                />
              </label>
            ))}
          </div>
          <div>
            <button
              type="button"
              className="btn btn-orange"
              disabled={setShowcase.isPending || !showcaseDrafts}
              onClick={() => {
                if (!showcaseDrafts) return;
                const num = (s: string) => {
                  const n = Number.parseInt(s, 10);
                  return s.trim() !== "" && Number.isFinite(n) && n >= 0 ? n : null;
                };
                setShowcase.mutate({
                  users: num(showcaseDrafts.users),
                  fiveStar: num(showcaseDrafts.fiveStar),
                  downloads: num(showcaseDrafts.downloads),
                });
              }}
            >
              {t(lang, "save")}
            </button>
          </div>
        </div>
        <div className="grid gap-1.5 border-t pt-2" style={{ borderColor: "var(--border)" }}>
          <p className="font-bold">{tx(lang, "Mục tiêu gợi ý khi đăng nhập lần đầu", "Suggested goals at first login")}</p>
          <p style={{ color: "var(--dim)" }}>
            {tx(lang, "Khi user đăng nhập lần đầu, LaSpace hiện hộp chọn mục tiêu học với các lựa chọn dưới đây. User chọn mục tiêu nào thì hệ thống tạo đúng mục tiêu đó cho họ; bấm “Để sau” thì không tạo. Tối đa 8 lựa chọn.", "At a user's first login, LaSpace shows a goal-picker box with the options below. Picking one creates exactly that goal for them; skipping creates none. Up to 8 options.")}
          </p>
          {(() => {
            const rows = goalDrafts ?? data.goalOptions.map((o) => ({ type: o.type, target: String(o.target), labelVi: o.labelVi, labelEn: o.labelEn }));
            const patch = (i: number, p: Partial<(typeof rows)[number]>) =>
              setGoalDrafts(rows.map((r, j) => (j === i ? { ...r, ...p } : r)));
            return (
              <div className="grid gap-1.5">
                {rows.map((r, i) => (
                  <div key={i} className="grid gap-1.5 sm:grid-cols-[110px_80px_1fr_1fr_auto]">
                    <select
                      className="input"
                      value={r.type}
                      onChange={(e) => patch(i, { type: e.target.value as typeof r.type })}
                      aria-label={tx(lang, "Loại mục tiêu", "Goal type")}
                    >
                      <option value="minutes">{tx(lang, "Phút học", "Minutes")}</option>
                      <option value="words">{tx(lang, "Từ vựng", "Words")}</option>
                      <option value="sessions">{tx(lang, "Buổi học", "Sessions")}</option>
                    </select>
                    <input
                      type="number"
                      min={1}
                      className="input"
                      value={r.target}
                      onChange={(e) => patch(i, { target: e.target.value })}
                      aria-label={tx(lang, "Số lượng mục tiêu", "Target amount")}
                    />
                    <input
                      className="input"
                      value={r.labelVi}
                      maxLength={120}
                      onChange={(e) => patch(i, { labelVi: e.target.value })}
                      placeholder={tx(lang, "Nhãn tiếng Việt", "Vietnamese label")}
                      aria-label={tx(lang, "Nhãn tiếng Việt", "Vietnamese label")}
                    />
                    <input
                      className="input"
                      value={r.labelEn}
                      maxLength={120}
                      onChange={(e) => patch(i, { labelEn: e.target.value })}
                      placeholder="English label"
                      aria-label="English label"
                    />
                    <button
                      type="button"
                      className="btn btn-sm btn-danger"
                      onClick={() => setGoalDrafts(rows.filter((_, j) => j !== i))}
                      aria-label={`${t(lang, "delete")} ${i + 1}`}
                    >
                      <Icon name="trash" size={12} />
                    </button>
                  </div>
                ))}
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    className="btn btn-sm"
                    disabled={rows.length >= 8}
                    onClick={() => setGoalDrafts([...rows, { type: "minutes", target: "100", labelVi: "", labelEn: "" }])}
                  >
                    <Icon name="plus" size={12} /> {tx(lang, "Thêm lựa chọn", "Add option")}
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-orange"
                    disabled={setGoalOptions.isPending || !goalDrafts}
                    onClick={() => {
                      const options = rows.map((r) => ({
                        type: r.type,
                        target: Number.parseInt(r.target, 10),
                        labelVi: r.labelVi.trim(),
                        labelEn: r.labelEn.trim(),
                      }));
                      if (options.length === 0 || options.some((o) => !Number.isFinite(o.target) || o.target < 1 || !o.labelVi || !o.labelEn)) {
                        setGoalError(tx(lang, "Mỗi lựa chọn cần có số lượng từ 1 trở lên và đủ nhãn tiếng Việt + tiếng Anh nhé.", "Each option needs a target of at least 1 and both a Vietnamese and an English label."));
                        return;
                      }
                      setGoalError("");
                      setGoalOptions.mutate(options);
                    }}
                  >
                    {t(lang, "save")}
                  </button>
                </div>
                {goalError ? <p style={{ color: "var(--bad)" }}>{goalError}</p> : null}
              </div>
            );
          })()}
        </div>
            </div>
          ) : null}

          {section === "donate" ? (
            <div className="card grid gap-2 p-3">
              <h3 className="font-display text-sm font-bold">Donate</h3>
        <div className="grid gap-1">
          <label className="flex min-h-7 cursor-pointer items-center gap-2" title={tx(lang, "Bật/tắt toàn bộ phần Donate ở phía người dùng", "Turn the whole Donate section on or off for users")}>
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={data.donateEnabled}
              disabled={setDonateEnabled.isPending}
              onChange={(e) => setDonateEnabled.mutate(e.target.checked)}
            />
            <Icon name="heart" size={13} />
            <span className="flex-1 font-semibold">{tx(lang, "Hiển thị phần Donate cho người dùng", "Show the Donate section to users")}</span>
            <span style={{ color: data.donateEnabled ? "var(--good)" : "var(--dim)" }}>{data.donateEnabled ? (tx(lang, "Đang bật", "On")) : (tx(lang, "Đang tắt", "Off"))}</span>
          </label>
          <p style={{ color: "var(--dim)" }}>
            {tx(lang, "Tắt đi thì thẻ “Ủng hộ LaSpace” ở Trang chính của người dùng ẩn hẳn và không tạo được mã donate mới; các giao dịch đã có vẫn giữ nguyên ở dưới để quản lý.", "When off, the “Support LaSpace” card disappears from every user's Home and no new donation codes can be created; existing transactions stay below for management.")}
          </p>
        </div>
        <p style={{ color: "var(--dim)" }}>
          {tx(lang, "Khi khách bấm Donate trong app, hệ thống tự tạo mã giao dịch và khoản donate hiện ngay tại đây với trạng thái “Chờ xác nhận”, kèm ngày giờ tạo mã; tiền về tài khoản thì bấm “Xác nhận đã nhận”. Cập nhật tài khoản nhận donate ở dưới để app tự tạo mã QR điền sẵn số tiền và mã giao dịch cho khách. Tổng donate chỉ tính các khoản đã xác nhận và không hiển thị công khai ngoài màn hình chào.", "When a customer taps Donate in the app, the system creates a transaction code and the donation appears here right away as “Pending”, with its creation date and time; once the money arrives, tap “Confirm received”. Update the receiving bank account below so the app can generate a QR code with the amount and transaction code pre-filled. Totals count confirmed donations only and are never shown publicly.")}
        </p>
        <BankInfoForm
          lang={lang}
          value={bankDraft ?? data.bankInfo}
          saved={data.bankInfo}
          justSaved={bankSaved}
          saveError={bankError}
          onDismissSaved={() => setBankSaved(false)}
          onChange={(next) => { setBankDraft(next); setBankSaved(false); setBankError(""); }}
          onSave={() => { if (bankDraft) setBankInfo.mutate(bankDraft); }}
          saving={setBankInfo.isPending}
        />
        <DonationList
          lang={lang}
          donations={data.donations}
          onConfirm={(id) => setDonationStatus.mutate({ id, status: "confirmed" })}
          onDelete={(id) => deleteDonation.mutate(id)}
          busy={setDonationStatus.isPending || deleteDonation.isPending}
        />
            </div>
          ) : null}

          {section === "password" ? (
            <div className="card grid gap-2 p-3">
              <h3 className="font-display text-sm font-bold">{tx(lang, "Mật khẩu Admin", "Admin password")}</h3>
        <div className="grid gap-1.5 sm:grid-cols-3">
          <label className="block">
            <span style={{ color: "var(--dim)" }}>{tx(lang, "Mật khẩu hiện tại", "Current password")}</span>
            <input maxLength={100} type="password" className="input" value={pwCurrent} onChange={(e) => { setPwCurrent(e.target.value); setPwDone(false); }} autoComplete="current-password" />
          </label>
          <label className="block">
            <span style={{ color: "var(--dim)" }}>{tx(lang, "Mật khẩu mới", "New password")}</span>
            <input maxLength={100} minLength={6} type="password" className="input" value={pwNew} onChange={(e) => { setPwNew(e.target.value); setPwDone(false); }} autoComplete="new-password" />
          </label>
          <label className="block">
            <span style={{ color: "var(--dim)" }}>{tx(lang, "Nhập lại mật khẩu mới", "Repeat new password")}</span>
            <input type="password" className="input" value={pwConfirm} onChange={(e) => { setPwConfirm(e.target.value); setPwDone(false); }} autoComplete="new-password" aria-label={tx(lang, "Nhập lại mật khẩu mới", "Repeat new password")} />
          </label>
        </div>
        {pwError ? <p style={{ color: "var(--bad)" }}>{pwError}</p> : null}
        {pwDone ? <p style={{ color: "var(--good)" }}>{tx(lang, "Đã đổi mật khẩu. Mật khẩu mới đã được máy chủ lưu ở dạng mã hóa.", "Password changed. The server has stored the new password as a hash.")}</p> : null}
        <div>
          <button
            type="button"
            className="btn btn-orange"
            disabled={changeAdminPassword.isPending}
            onClick={() => {
              if (!pwCurrent) { setPwError(tx(lang, "Hãy nhập mật khẩu hiện tại nhé.", "Enter your current password.")); return; }
              if (pwNew.length < 6) { setPwError(tx(lang, "Mật khẩu mới cần ít nhất 6 ký tự.", "The new password needs at least 6 characters.")); return; }
              if (pwNew !== pwConfirm) { setPwError(tx(lang, "Mật khẩu mới nhập lại chưa khớp.", "The repeated password does not match.")); return; }
              setPwError("");
              changeAdminPassword.mutate();
            }}
          >
            <Icon name="lock" size={12} /> {tx(lang, "Đổi mật khẩu Admin", "Change admin password")}
          </button>
        </div>
            </div>
          ) : null}
          {section === "resets" ? (
            <div className="card grid gap-2 p-3">
              <h3 className="font-display text-sm font-bold">{tx(lang, "Quên mật khẩu", "Password resets")}</h3>
        <p style={{ color: "var(--dim)" }}>
          {tx(lang, "Người dùng bấm “Quên mật khẩu?” ở màn hình đăng nhập sẽ hiện ở đây. Bấm “Cấp mật khẩu tạm” để hệ thống đặt một mật khẩu tạm (chỉ lưu dạng mã hóa ở máy chủ), gửi mật khẩu tạm đó cho người dùng qua kênh liên hệ của bạn — họ đăng nhập bằng mật khẩu tạm rồi đổi mật khẩu mới trong Cài đặt.", "Users who tap “Forgot password?” on the login screen appear here. Issue a temporary password (stored server-side only as a hash), send it to the user through your contact channel — they sign in with it and set a new password in Settings.")}
        </p>
        {tempPw ? (
          <div className="card grid gap-1 p-3" style={{ borderColor: "var(--accent)" }}>
            <p>
              {tx(lang, "Mật khẩu tạm cho", "Temporary password for")} <b>{tempPw.userName}</b> ({tempPw.email}):
            </p>
            <p className="font-display text-base font-extrabold tracking-widest" style={{ color: "var(--accent)" }}>{tempPw.tempPassword}</p>
            <p style={{ color: "var(--dim)" }}>
              {tx(lang, "Mật khẩu tạm chỉ hiện một lần này. Hãy gửi ngay cho người dùng nhé.", "This temporary password is shown only once. Send it to the user now.")}
            </p>
            <div>
              <button type="button" className="btn btn-sm" onClick={() => setTempPw(null)}>{tx(lang, "Đã gửi xong", "Done")}</button>
            </div>
          </div>
        ) : null}
        {resetsQ.isPending ? (
          <p style={{ color: "var(--dim)" }}>{tx(lang, "Đang tải…", "Loading…")}</p>
        ) : (resetsQ.data?.requests.length ?? 0) === 0 ? (
          <p style={{ color: "var(--dim)" }}>{tx(lang, "Chưa có yêu cầu đặt lại mật khẩu nào.", "No password reset requests yet.")}</p>
        ) : (
          <div className="grid gap-1.5">
            {resetsQ.data?.requests.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center gap-2 rounded-lg px-2 py-1.5" style={{ background: "var(--surface2)" }}>
                <span className="min-w-0 flex-1">
                  <b>{r.userName || r.email}</b>{" "}
                  <span style={{ color: "var(--dim)" }}>{r.email} · {fmtDateTime(r.createdAt, lang)}</span>
                </span>
                <button
                  type="button"
                  className="btn btn-sm btn-orange"
                  disabled={r.userId == null || issueTempPw.isPending}
                  onClick={() => { if (r.userId != null) issueTempPw.mutate(r.userId); }}
                >
                  <Icon name="lock" size={12} /> {tx(lang, "Cấp mật khẩu tạm", "Issue temp password")}
                </button>
              </div>
            ))}
          </div>
        )}
            </div>
          ) : null}

          {section === "contacts" ? (
            <div className="card grid gap-2 p-3">
              <h3 className="font-display text-sm font-bold">{tx(lang, "Liên hệ & mạng xã hội", "Contact & social links")}</h3>
        <p style={{ color: "var(--dim)" }}>
          {tx(lang, "Thêm link Zalo, Telegram, Facebook, YouTube, Threads… — icon của từng nền tảng sẽ tự lấy theo link. Các icon này hiện ở màn hình chào và chân trang của app.", "Add Zalo, Telegram, Facebook, YouTube, Threads… links — each platform's icon is picked automatically from the link. Icons appear on the welcome screen and in the app footer.")}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {PLATFORM_PRESETS.map((p) => (
            <button
              key={p.name}
              type="button"
              className={`tabbtn ${ctPlatform === p.name ? "active" : ""}`}
              onClick={() => { setCtPlatform(p.name); setCtError(""); }}
            >
              {p.name}
            </button>
          ))}
        </div>
        <div className="grid gap-1.5 sm:grid-cols-2">
          <label className="block">
            <span style={{ color: "var(--dim)" }}>{tx(lang, "Tên nền tảng", "Platform name")}</span>
            <input maxLength={40} required className="input" value={ctPlatform} onChange={(e) => setCtPlatform(e.target.value)} placeholder="Zalo, Threads, TikTok…" />
          </label>
          <label className="block">
            <span style={{ color: "var(--dim)" }}>{tx(lang, "Link liên kết", "Link")}</span>
            <input
              maxLength={300}
              className="input"
              value={ctUrl}
              onChange={(e) => setCtUrl(e.target.value)}
              placeholder={PLATFORM_PRESETS.find((p) => p.name === ctPlatform)?.hint ?? "https://…"}
            />
          </label>
        </div>
        {ctError ? <p style={{ color: "var(--bad)" }}>{ctError}</p> : null}
        <div>
          <button
            type="button"
            className="btn btn-orange"
            disabled={addContact.isPending}
            onClick={() => {
              if (!ctPlatform.trim()) { setCtError(tx(lang, "Hãy chọn hoặc nhập tên nền tảng nhé.", "Pick or type a platform name.")); return; }
              if (!/^https?:\/\//i.test(ctUrl.trim())) { setCtError(tx(lang, "Link cần bắt đầu bằng https:// nhé.", "The link must start with https://.")); return; }
              setCtError("");
              addContact.mutate();
            }}
          >
            <Icon name="plus" size={12} /> {tx(lang, "Thêm link liên hệ", "Add contact link")}
          </button>
        </div>
        <div className="grid gap-1">
          {data.contacts.map((c) => (
            <div key={c.id} className="flex items-center gap-2 border-t py-1.5" style={{ borderColor: "var(--border)" }}>
              <ContactIcon contact={c} size={28} />
              <span className="font-bold">{c.platform}</span>
              <a href={c.url} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate font-semibold" style={{ color: "var(--accent)" }}>
                {c.url}
              </a>
              <button
                type="button"
                className="btn btn-sm btn-danger"
                disabled={deleteContact.isPending}
                onClick={() => deleteContact.mutate(c.id)}
                aria-label={`${t(lang, "delete")}: ${c.platform}`}
              >
                <Icon name="trash" size={12} />
              </button>
            </div>
          ))}
          {data.contacts.length === 0 ? <p style={{ color: "var(--dim)" }}>{tx(lang, "Chưa có link liên hệ nào.", "No contact links yet.")}</p> : null}
        </div>
            </div>
          ) : null}

          {section === "users" ? (
            <div className="card grid gap-2 p-3">
              <h3 className="font-display text-sm font-bold">{tx(lang, "Quản lý người dùng", "User management")}</h3>
        <div className="grid gap-1.5">
          {data.users.map((u) => {
            const expanded = expandedUser === u.id;
            return (
              <div key={u.id} className="card grid gap-1 px-2.5 py-2">
                <button
                  type="button"
                  className="flex w-full flex-wrap items-center gap-2 text-left"
                  onClick={() => setExpandedUser(expanded ? null : u.id)}
                  aria-expanded={expanded}
                  aria-label={`${u.name} — ${expanded ? (tx(lang, "Thu gọn", "Collapse")) : (tx(lang, "Mở chi tiết", "Expand details"))}`}
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-full font-bold text-white" style={{ background: "linear-gradient(135deg,#2f6bff,#7c3aed)" }}>
                    {u.name.charAt(0).toUpperCase()}
                  </span>
                  <span className="text-sm font-bold">{u.name}</span>
                  <span className="min-w-0 truncate" style={{ color: "var(--dim)" }}>{u.email}</span>
                  <span className={`chip ${u.role === "admin" ? "chip-orange" : ""}`}>{u.role === "admin" ? "Admin" : "User"}</span>
                  {u.permissions.map((k) => {
                    const p = PERMISSIONS.find((x) => x.key === k);
                    return <span key={k} className="chip chip-violet">{p ? permName(lang, p.key) : k}</span>;
                  })}
                  {u.guest ? <span className="chip">{tx(lang, "Khách", "Guest")}</span> : null}
                  {u.locked ? <span className="chip" style={{ color: "var(--bad)" }}>{tx(lang, "Đã khóa", "Locked")}</span> : null}
                  <span className="ml-auto"><Icon name={expanded ? "chevD" : "chevR"} size={13} /></span>
                </button>
                {expanded ? (
                  <>
                    <div className="flex flex-wrap items-center gap-1.5" style={{ color: "var(--dim)" }}>
                      <span>{u.spaceCount} {tx(lang, "không gian", "spaces")} · {tx(lang, "từ", "since")} {fmtDate(u.createdAt, lang)}</span>
                      <span className="ml-auto flex flex-wrap gap-1.5">
                        <button type="button" className="btn btn-sm" onClick={() => onViewUser(u.id)}>
                          {tx(lang, "Xem giao diện của user", "View as user")}
                        </button>
                        {u.id !== selfId ? (
                          <>
                            <button type="button" className="btn btn-sm" onClick={() => setConfirmRole({ id: u.id, name: u.name, role: u.role === "admin" ? "user" : "admin" })}>
                              {u.role === "admin" ? (tx(lang, "Hạ xuống User", "Demote to User")) : (tx(lang, "Lên Admin", "Make Admin"))}
                            </button>
                            <button type="button" className="btn btn-sm btn-danger" onClick={() => setLocked.mutate({ id: u.id, locked: !u.locked })}>
                              {u.locked ? (tx(lang, "Mở khóa", "Unlock")) : (tx(lang, "Khóa", "Lock"))}
                            </button>
                            <button type="button" className="btn btn-sm" disabled={resetUserPassword.isPending} onClick={() => { setResetPwResult(null); setConfirmResetPw({ id: u.id, name: u.name }); }} title={tx(lang, "Tạo mật khẩu tạm mới cho user này (mật khẩu của user không xem được)", "Create a new temporary password for this user (their own password cannot be viewed)")}>
                              <Icon name="lock" size={12} /> {tx(lang, "Đặt lại mật khẩu", "Reset password")}
                            </button>
                            <button type="button" className="btn btn-sm btn-danger" onClick={() => setConfirmDeleteUser({ id: u.id, name: u.name, email: u.email })}>
                              <Icon name="trash" size={12} /> {tx(lang, "Xóa tài khoản", "Delete account")}
                            </button>
                          </>
                        ) : (
                          <span className="chip chip-violet">{tx(lang, "Bạn", "You")}</span>
                        )}
                      </span>
                    </div>
                    {resetPwResult && resetPwResult.id === u.id ? (
                      <p role="alert" className="rounded-lg border px-2.5 py-2" style={{ borderColor: "var(--good)", color: "var(--text)" }}>
                        {tx(lang, "Mật khẩu tạm cho", "Temporary password for")} {resetPwResult.name} ({resetPwResult.email}):{" "}
                        <b className="font-display tracking-widest" style={{ color: "var(--accent)" }}>{resetPwResult.pw}</b>
                        <span className="block" style={{ color: "var(--dim)" }}>{tx(lang, "Mật khẩu tạm chỉ hiện một lần này. Hãy gửi ngay cho người dùng nhé.", "This temporary password is shown only once. Send it to the user now.")}</span>
                      </p>
                    ) : null}
                    <div className="flex flex-wrap items-center gap-1.5 border-t pt-1.5" style={{ borderColor: "var(--border)" }}>
                      <span style={{ color: "var(--dim)" }}>
                        {tx(lang, "Giới hạn không gian:", "Space limit:")}{" "}
                        <b style={{ color: "var(--text)" }}>{u.maxSpaces ?? data.maxSpaces}</b>
                        {u.maxSpaces != null ? <span className="chip chip-orange ml-1">{tx(lang, "Đã nâng cấp", "Upgraded")}</span> : <span style={{ color: "var(--dim)" }}> ({tx(lang, "mặc định", "default")})</span>}
                      </span>
                      <span className="ml-auto flex flex-wrap items-center gap-1.5">
                        <input
                          min={1} max={100}
                          type="number"
                          className="input"
                          style={{ width: 60 }}
                          value={spaceDrafts[u.id] ?? (u.maxSpaces != null ? String(u.maxSpaces) : "")}
                          placeholder={String(data.maxSpaces)}
                          onChange={(e) => setSpaceDrafts((d) => ({ ...d, [u.id]: e.target.value }))}
                          aria-label={`${tx(lang, "Nâng cấp số không gian cho", "Upgrade space limit for")} ${u.name}`}
                        />
                        <button
                          type="button"
                          className="btn btn-sm btn-orange"
                          disabled={setUserMaxSpaces.isPending}
                          onClick={() => {
                            const n = Number(spaceDrafts[u.id]);
                            if (Number.isFinite(n) && n >= 1) setUserMaxSpaces.mutate({ id: u.id, value: n });
                          }}
                        >
                          {tx(lang, "Nâng cấp", "Upgrade")}
                        </button>
                        {u.maxSpaces != null ? (
                          <button
                            type="button"
                            className="btn btn-sm"
                            disabled={setUserMaxSpaces.isPending}
                            onClick={() => setUserMaxSpaces.mutate({ id: u.id, value: null })}
                          >
                            {tx(lang, "Về mặc định", "Reset to default")}
                          </button>
                        ) : null}
                      </span>
                    </div>
                    <UserInfoGrid lang={lang} u={u} />
                    {u.role !== "admin" ? (
                      <div className="grid gap-1.5">
                        <PermissionsEditor
                          lang={lang}
                          value={permDrafts[u.id] ?? u.permissions}
                          onChange={(next) => setPermDrafts((d) => ({ ...d, [u.id]: next }))}
                        />
                        <div>
                          <button
                            type="button"
                            className="btn btn-sm btn-orange"
                            disabled={setPermissions.isPending || !permDrafts[u.id]}
                            onClick={() => setPermissions.mutate({ id: u.id, permissions: permDrafts[u.id] ?? u.permissions })}
                          >
                            {tx(lang, "Lưu quyền", "Save permissions")}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="border-t pt-1.5" style={{ borderColor: "var(--border)", color: "var(--dim)" }}>
                        {tx(lang, "Tài khoản Admin có toàn quyền, không cần cấp thêm.", "Admin accounts hold every permission already.")}
                      </p>
                    )}
                  </>
                ) : null}
              </div>
            );
          })}
        </div>
            </div>
          ) : null}
        </div>
      )}

      {confirmRole ? (
        <ConfirmDialog
          lang={lang}
          message={txf(lang, "Đổi vai trò của {0} thành {1}?", "Change {0}'s role to {1}?", confirmRole.name, confirmRole.role === "admin" ? "Admin" : "User")}
          confirmLabel={tx(lang, "Đổi vai trò", "Change role")}
          onConfirm={() => setRole.mutate({ id: confirmRole.id, role: confirmRole.role })}
          onCancel={() => setConfirmRole(null)}
        />
      ) : null}

      {confirmDeleteUser ? (
        <ConfirmDialog
          lang={lang}
          message={txf(lang, "Xóa vĩnh viễn tài khoản {0} ({1})? Toàn bộ không gian, từ vựng, ghi nhớ, buổi học và mục tiêu của user này sẽ bị xóa và không khôi phục được.", "Permanently delete {0} ({1})? All their spaces, words, notes, sessions and goals will be removed and cannot be restored.", confirmDeleteUser.name, confirmDeleteUser.email)}
          confirmLabel={tx(lang, "Xóa tài khoản", "Delete account")}
          onConfirm={() => deleteUser.mutate(confirmDeleteUser.id)}
          onCancel={() => setConfirmDeleteUser(null)}
        />
      ) : null}

      {confirmResetPw ? (
        <ConfirmDialog
          lang={lang}
          message={tx(lang, "Đặt lại mật khẩu của user này? User sẽ bị đăng xuất ở mọi thiết bị và cần mật khẩu tạm bạn sắp nhận để đăng nhập lại.", "Reset this user's password? They will be signed out everywhere and will need the temporary password you are about to receive.")}
          confirmLabel={tx(lang, "Đặt lại mật khẩu", "Reset password")}
          onConfirm={() => resetUserPassword.mutate(confirmResetPw.id)}
          onCancel={() => setConfirmResetPw(null)}
        />
      ) : null}
    </div>
  );
}

export function UserViewPreview({
  token,
  lang,
  userId,
  onExit,
}: {
  token: string;
  lang: Lang;
  userId: number;
  onExit: () => void;
}) {
  const L = lang === "vi";
  const queryClient = useQueryClient();
  const viewQ = useQuery({
    queryKey: ["admin-view", userId],
    queryFn: () => api.adminGetUserView({ token, userId }),
  });
  const data = viewQ.data;
  const [openSpaceId, setOpenSpaceId] = useState<number | null>(null);
  const [confirm, setConfirm] = useState<
    | { kind: "space"; id: number; label: string }
    | { kind: "word"; id: number; label: string }
    | { kind: "note"; id: number; label: string }
    | { kind: "session"; id: number; label: string }
    | null
  >(null);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["admin-view", userId] });
    queryClient.invalidateQueries({ queryKey: ["admin"] });
  };
  const deleteSpace = useMutation({
    mutationFn: (id: number) => api.adminDeleteUserSpace({ token, spaceId: id }),
    onSuccess: () => { invalidate(); setConfirm(null); },
  });
  const deleteWord = useMutation({
    mutationFn: (id: number) => api.adminDeleteUserWord({ token, wordId: id }),
    onSuccess: () => { invalidate(); setConfirm(null); },
  });
  const deleteNote = useMutation({
    mutationFn: (id: number) => api.adminDeleteUserNote({ token, noteId: id }),
    onSuccess: () => { invalidate(); setConfirm(null); },
  });
  const deleteSession = useMutation({
    mutationFn: (id: number) => api.adminDeleteUserSession({ token, sessionId: id }),
    onSuccess: () => { invalidate(); setConfirm(null); },
  });
  const busy = deleteSpace.isPending || deleteWord.isPending || deleteNote.isPending || deleteSession.isPending;

  return (
    <div className="grid gap-3">
      <div className="card flex flex-wrap items-center gap-2 p-2.5" style={{ borderColor: "var(--accent)" }}>
        <Icon name="shield" size={14} />
        <span className="font-semibold">
          {tx(lang, "Admin đang xem toàn bộ không gian của user", "Admin viewing all of this user's spaces")}
          {data ? `: ${data.target.name} (${data.target.email})` : ""}
        </span>
        <button type="button" className="btn btn-orange ml-auto" onClick={onExit}>
          {tx(lang, "Quay lại Dashboard Admin", "Back to Admin dashboard")}
        </button>
      </div>

      {viewQ.isPending ? <p style={{ color: "var(--dim)" }}>{tx(lang, "Đang tải…", "Loading…")}</p> : null}
      {data ? (
        <>
          <div className="grid grid-cols-3 gap-2">
            <div className="card p-2.5 text-center">
              <p className="font-display text-base font-extrabold">{data.stats.totalMinutes} {t(lang, "minutes")}</p>
              <p style={{ color: "var(--dim)" }}>{t(lang, "totalStudy")}</p>
            </div>
            <div className="card p-2.5 text-center">
              <p className="font-display text-base font-extrabold">{data.stats.sessionCount}</p>
              <p style={{ color: "var(--dim)" }}>{t(lang, "sessionsDone")}</p>
            </div>
            <div className="card p-2.5 text-center">
              <p className="font-display text-base font-extrabold">{data.stats.wordCount}</p>
              <p style={{ color: "var(--dim)" }}>{tx(lang, "Từ vựng", "Words")}</p>
            </div>
          </div>
          <div className="grid gap-1.5">
            <h3 className="font-display text-sm font-bold">
              {tx(lang, "Toàn bộ không gian của user", "All of the user's spaces")} ({data.spaces.length})
            </h3>
            {data.spaces.map((s) => {
              const detail = data.spaceDetails.find((d) => d.spaceId === s.id);
              const open = openSpaceId === s.id;
              return (
                <div key={s.id} className="card px-2.5 py-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      className="flex min-w-0 flex-1 items-center gap-2 text-left"
                      onClick={() => setOpenSpaceId(open ? null : s.id)}
                      aria-expanded={open}
                      aria-label={`${s.name} — ${open ? (tx(lang, "Thu gọn", "Collapse")) : (tx(lang, "Xem toàn bộ nội dung", "View all contents"))}`}
                    >
                      <span className="text-sm font-bold">{s.name}</span>
                      <Icon name={open ? "chevD" : "chevR"} size={13} />
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-danger"
                      disabled={busy}
                      onClick={() => setConfirm({ kind: "space", id: s.id, label: s.name })}
                    >
                      <Icon name="trash" size={12} /> {tx(lang, "Xóa không gian", "Delete space")}
                    </button>
                  </div>
                  <p style={{ color: "var(--dim)" }}>
                    {s.wordCount} {t(lang, "words")} · {detail?.notes.length ?? 0} {tx(lang, "ghi nhớ", "notes")} · {detail?.sessions.length ?? 0} {tx(lang, "buổi học", "sessions")} · {s.features.length ? s.features.map((k) => FEATURE_TEXT[k]?.name[lang] ?? k).join(", ") : (tx(lang, "chưa có tính năng", "no features yet"))}
                  </p>
                  {open && detail ? (
                    <div className="grid gap-2 border-t pt-2" style={{ borderColor: "var(--border)" }}>
                      <div className="grid gap-1">
                        <p className="font-bold">{tx(lang, "Từ vựng", "Words")} ({detail.words.length})</p>
                        {detail.words.map((w) => (
                          <div key={w.id} className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold">{w.word}</span>
                            {w.meaning ? <span style={{ color: "var(--dim)" }}>{w.meaning}</span> : null}
                            {w.inFlashcards ? <span className="chip chip-violet">Flashcards{w.nextReviewAt ? ` · ${fmtDate(w.nextReviewAt, lang)}` : ""}</span> : null}
                            <button
                              type="button"
                              className="btn btn-sm btn-danger ml-auto"
                              disabled={busy}
                              onClick={() => setConfirm({ kind: "word", id: w.id, label: w.word })}
                              aria-label={`${t(lang, "delete")}: ${w.word}`}
                            >
                              <Icon name="trash" size={12} />
                            </button>
                          </div>
                        ))}
                        {detail.words.length === 0 ? <p style={{ color: "var(--dim)" }}>{tx(lang, "Chưa có từ nào.", "No words yet.")}</p> : null}
                      </div>
                      <div className="grid gap-1">
                        <p className="font-bold">{tx(lang, "Ghi nhớ", "Notes")} ({detail.notes.length})</p>
                        {detail.notes.map((n) => (
                          <div key={n.id} className="flex flex-wrap items-start gap-2">
                            <span className="min-w-0 flex-1">
                              <span className="font-semibold">{n.title}</span>
                              {n.content ? <span className="block truncate" style={{ color: "var(--dim)" }}>{n.content}</span> : null}
                            </span>
                            <button
                              type="button"
                              className="btn btn-sm btn-danger"
                              disabled={busy}
                              onClick={() => setConfirm({ kind: "note", id: n.id, label: n.title })}
                              aria-label={`${t(lang, "delete")}: ${n.title}`}
                            >
                              <Icon name="trash" size={12} />
                            </button>
                          </div>
                        ))}
                        {detail.notes.length === 0 ? <p style={{ color: "var(--dim)" }}>{tx(lang, "Chưa có ghi nhớ nào.", "No notes yet.")}</p> : null}
                      </div>
                      <div className="grid gap-1">
                        <p className="font-bold">{tx(lang, "Buổi học", "Study sessions")} ({detail.sessions.length})</p>
                        {detail.sessions.map((ss) => (
                          <div key={ss.id} className="flex flex-wrap items-center gap-2">
                            <span className="flex-1 font-semibold">{ss.title}</span>
                            <span style={{ color: "var(--dim)" }}>{ss.minutes} {t(lang, "minutes")} · {fmtDateTime(ss.completedAt, lang)}</span>
                            <button
                              type="button"
                              className="btn btn-sm btn-danger"
                              disabled={busy}
                              onClick={() => setConfirm({ kind: "session", id: ss.id, label: ss.title })}
                              aria-label={`${t(lang, "delete")}: ${ss.title}`}
                            >
                              <Icon name="trash" size={12} />
                            </button>
                          </div>
                        ))}
                        {detail.sessions.length === 0 ? <p style={{ color: "var(--dim)" }}>{tx(lang, "Chưa có buổi học nào.", "No sessions yet.")}</p> : null}
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
            {data.spaces.length === 0 ? <p style={{ color: "var(--dim)" }}>{tx(lang, "User chưa tạo không gian nào.", "This user has no spaces yet.")}</p> : null}
          </div>
          {data.goals.length ? (
            <div className="grid gap-1.5">
              <h3 className="font-display text-sm font-bold">{tx(lang, "Mục tiêu của user", "User's goals")}</h3>
              {data.goals.map((g) => {
                const st = goalStatus(g, lang);
                return (
                  <div key={g.id} className="card grid gap-1 px-2.5 py-2">
                    <div className="flex items-center gap-2">
                      <span className="flex-1 font-bold">{goalTitle(g, lang)}</span>
                      <span>{st.pct}%</span>
                    </div>
                    <div className="progress-track"><div className="progress-fill" style={{ width: `${st.pct}%` }} /></div>
                  </div>
                );
              })}
            </div>
          ) : null}
        </>
      ) : null}

      {confirm ? (
        <ConfirmDialog
          lang={lang}
          message={
            confirm.kind === "space"
              ? txf(lang, "Xóa không gian “{0}” của user này? Toàn bộ nội dung trong đó sẽ bị xóa.", "Delete this user's space “{0}”? Everything inside it will be removed.", confirm.label)
              : txf(lang, "Xóa “{0}” khỏi không gian của user này?", "Delete “{0}” from this user's space?", confirm.label)
          }
          confirmLabel={t(lang, "delete")}
          onConfirm={() => {
            if (confirm.kind === "space") deleteSpace.mutate(confirm.id);
            else if (confirm.kind === "word") deleteWord.mutate(confirm.id);
            else if (confirm.kind === "note") deleteNote.mutate(confirm.id);
            else deleteSession.mutate(confirm.id);
          }}
          onCancel={() => setConfirm(null)}
        />
      ) : null}
    </div>
  );
}

// ================================================================ Staff panel
// The scoped work area a non-admin account sees for exactly the permissions
// an admin granted it (users / finance / content / system). The server
// returns only the permitted slices and re-checks every mutation.
export function StaffPanel({ token, lang, selfId }: { token: string; lang: Lang; selfId: number }) {
  const L = lang === "vi";
  const queryClient = useQueryClient();
  const staffQ = useQuery({ queryKey: ["staff"], queryFn: () => api.staffOverview({ token }) });
  const [open, setOpen] = useState<string>("");
  const [expandedUser, setExpandedUser] = useState<number | null>(null);
  const [spaceDrafts, setSpaceDrafts] = useState<Record<number, string>>({});
  const [maxSpacesDraft, setMaxSpacesDraft] = useState<number | null>(null);
  const [bankDraft, setBankDraft] = useState<BankDraft | null>(null);
  const [bankSaved, setBankSaved] = useState(false);
  const [bankError, setBankError] = useState("");
  const [ctPlatform, setCtPlatform] = useState("");
  const [ctUrl, setCtUrl] = useState("");
  const [ctError, setCtError] = useState("");

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["staff"] });
    queryClient.invalidateQueries({ queryKey: ["public-info"] });
    queryClient.invalidateQueries({ queryKey: ["me"] });
  };
  const setLocked = useMutation({
    mutationFn: (args: { id: number; locked: boolean }) => api.adminSetUserLocked({ token, userId: args.id, locked: args.locked }),
    onSuccess: invalidate,
  });
  const setUserMaxSpaces = useMutation({
    mutationFn: (args: { id: number; value: number | null }) => api.adminSetUserMaxSpaces({ token, userId: args.id, value: args.value }),
    onSuccess: invalidate,
  });
  const setMaxSpaces = useMutation({
    mutationFn: (value: number) => api.adminSetMaxSpaces({ token, value }),
    onSuccess: invalidate,
  });
  const setFlag = useMutation({
    mutationFn: (args: { key: string; enabled: boolean }) => api.adminSetFeatureFlag({ token, featureKey: args.key as "flashcards", enabled: args.enabled }),
    onSuccess: invalidate,
  });
  const setBankInfo = useMutation({
    mutationFn: (b: BankDraft) => api.adminSetBankInfo({ token, ...b }),
    onSuccess: () => { invalidate(); setBankDraft(null); setBankError(""); setBankSaved(true); },
    onError: (e) => { setBankSaved(false); setBankError(e.message); },
  });
  const setDonationStatus = useMutation({
    mutationFn: (args: { id: number; status: "pending" | "confirmed" }) => api.adminSetDonationStatus({ token, donationId: args.id, status: args.status }),
    onSuccess: invalidate,
  });
  const deleteDonation = useMutation({
    mutationFn: (id: number) => api.adminDeleteDonation({ token, donationId: id }),
    onSuccess: invalidate,
  });
  const setDonateEnabled = useMutation({
    mutationFn: (enabled: boolean) => api.adminSetDonateEnabled({ token, enabled }),
    onSuccess: invalidate,
  });
  const addContact = useMutation({
    mutationFn: () => api.adminAddContact({ token, platform: ctPlatform.trim(), url: ctUrl.trim() }),
    onSuccess: () => { invalidate(); setCtPlatform(""); setCtUrl(""); setCtError(""); },
    onError: (e) => setCtError(e.message),
  });
  const deleteContact = useMutation({
    mutationFn: (id: string) => api.adminDeleteContact({ token, contactId: id }),
    onSuccess: invalidate,
  });

  const data = staffQ.data;
  if (staffQ.isPending) return <p style={{ color: "var(--dim)" }}>{tx(lang, "Đang tải…", "Loading…")}</p>;
  if (!data) return <p style={{ color: "var(--bad)" }}>{tx(lang, "Không tải được khu vực được phân quyền.", "Could not load your granted area.")}</p>;
  const toggle = (id: string) => setOpen(open === id ? "" : id);

  return (
    <div className="grid gap-3">
      <h2 className="font-display text-base font-extrabold">{tx(lang, "Khu vực được phân quyền", "Your granted area")}</h2>
      <div className="flex flex-wrap gap-1.5">
        {data.permissions.map((k) => {
          const p = PERMISSIONS.find((x) => x.key === k);
          return <span key={k} className="chip chip-violet">{p ? permName(lang, p.key) : k}</span>;
        })}
      </div>

      {data.users ? (
        <AdminSection title={tx(lang, "Quản lý người dùng", "User management")} badge={String(data.users.length)} open={open === "users"} onToggle={() => toggle("users")}>
          <div className="grid gap-1.5">
            {data.users.map((u) => {
              const expanded = expandedUser === u.id;
              return (
                <div key={u.id} className="card grid gap-1 px-2.5 py-2">
                  <button
                    type="button"
                    className="flex w-full flex-wrap items-center gap-2 text-left"
                    onClick={() => setExpandedUser(expanded ? null : u.id)}
                    aria-expanded={expanded}
                    aria-label={`${u.name} — ${expanded ? (tx(lang, "Thu gọn", "Collapse")) : (tx(lang, "Mở chi tiết", "Expand details"))}`}
                  >
                    <span className="flex h-6 w-6 items-center justify-center rounded-full font-bold text-white" style={{ background: "linear-gradient(135deg,#2f6bff,#7c3aed)" }}>
                      {u.name.charAt(0).toUpperCase()}
                    </span>
                    <span className="text-sm font-bold">{u.name}</span>
                    <span className="min-w-0 truncate" style={{ color: "var(--dim)" }}>{u.email}</span>
                    <span className={`chip ${u.role === "admin" ? "chip-orange" : ""}`}>{u.role === "admin" ? "Admin" : "User"}</span>
                    {u.locked ? <span className="chip" style={{ color: "var(--bad)" }}>{tx(lang, "Đã khóa", "Locked")}</span> : null}
                    <span className="ml-auto"><Icon name={expanded ? "chevD" : "chevR"} size={13} /></span>
                  </button>
                  {expanded ? (
                    <>
                      <div className="flex flex-wrap items-center gap-1.5" style={{ color: "var(--dim)" }}>
                        <span>{u.spaceCount} {tx(lang, "không gian", "spaces")} · {tx(lang, "từ", "since")} {fmtDate(u.createdAt, lang)}</span>
                        {u.id !== selfId && u.role !== "admin" ? (
                          <button type="button" className="btn btn-sm btn-danger ml-auto" onClick={() => setLocked.mutate({ id: u.id, locked: !u.locked })}>
                            {u.locked ? (tx(lang, "Mở khóa", "Unlock")) : (tx(lang, "Khóa", "Lock"))}
                          </button>
                        ) : null}
                      </div>
                      <UserInfoGrid lang={lang} u={u} />
                      <div className="flex flex-wrap items-center gap-1.5 border-t pt-1.5" style={{ borderColor: "var(--border)" }}>
                        <span style={{ color: "var(--dim)" }}>
                          {tx(lang, "Giới hạn không gian:", "Space limit:")} <b style={{ color: "var(--text)" }}>{u.maxSpaces ?? data.system?.maxSpaces ?? 3}</b>
                          {u.maxSpaces != null ? <span className="chip chip-orange ml-1">{tx(lang, "Đã nâng cấp", "Upgraded")}</span> : null}
                        </span>
                        <span className="ml-auto flex flex-wrap items-center gap-1.5">
                          <input
                            min={1} max={100}
                            type="number"
                            className="input"
                            style={{ width: 60 }}
                            value={spaceDrafts[u.id] ?? (u.maxSpaces != null ? String(u.maxSpaces) : "")}
                            onChange={(e) => setSpaceDrafts((d) => ({ ...d, [u.id]: e.target.value }))}
                            aria-label={`${tx(lang, "Nâng cấp số không gian cho", "Upgrade space limit for")} ${u.name}`}
                          />
                          <button
                            type="button"
                            className="btn btn-sm btn-orange"
                            disabled={setUserMaxSpaces.isPending}
                            onClick={() => {
                              const n = Number(spaceDrafts[u.id]);
                              if (Number.isFinite(n) && n >= 1) setUserMaxSpaces.mutate({ id: u.id, value: n });
                            }}
                          >
                            {tx(lang, "Nâng cấp", "Upgrade")}
                          </button>
                          {u.maxSpaces != null ? (
                            <button type="button" className="btn btn-sm" disabled={setUserMaxSpaces.isPending} onClick={() => setUserMaxSpaces.mutate({ id: u.id, value: null })}>
                              {tx(lang, "Về mặc định", "Reset to default")}
                            </button>
                          ) : null}
                        </span>
                      </div>
                    </>
                  ) : null}
                </div>
              );
            })}
          </div>
        </AdminSection>
      ) : null}

      {data.finance ? (
        <AdminSection
          title={tx(lang, "Donate", "Donations")}
          badge={`${fmtMoney(data.finance.total)}${data.finance.pendingCount ? ` · ${data.finance.pendingCount} ${tx(lang, "chờ", "pending")}` : ""}`}
          open={open === "finance"}
          onToggle={() => toggle("finance")}
        >
          <div className="grid gap-1">
            <label className="flex min-h-7 cursor-pointer items-center gap-2" title={tx(lang, "Bật/tắt toàn bộ phần Donate ở phía người dùng", "Turn the whole Donate section on or off for users")}>
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={data.finance.donateEnabled}
                disabled={setDonateEnabled.isPending}
                onChange={(e) => setDonateEnabled.mutate(e.target.checked)}
              />
              <Icon name="heart" size={13} />
              <span className="flex-1 font-semibold">{tx(lang, "Hiển thị phần Donate cho người dùng", "Show the Donate section to users")}</span>
              <span style={{ color: data.finance.donateEnabled ? "var(--good)" : "var(--dim)" }}>{data.finance.donateEnabled ? (tx(lang, "Đang bật", "On")) : (tx(lang, "Đang tắt", "Off"))}</span>
            </label>
            <p style={{ color: "var(--dim)" }}>
              {tx(lang, "Tắt đi thì thẻ “Ủng hộ LaSpace” ở Trang chính của người dùng ẩn hẳn và không tạo được mã donate mới; các giao dịch đã có vẫn giữ nguyên ở dưới để quản lý.", "When off, the “Support LaSpace” card disappears from every user's Home and no new donation codes can be created; existing transactions stay below for management.")}
            </p>
          </div>
          <p style={{ color: "var(--dim)" }}>
            {tx(lang, "Khoản donate khách tự tạo mã trong app hiện ở đây với trạng thái “Chờ xác nhận”, kèm ngày giờ tạo mã; tiền về thì bấm “Xác nhận đã nhận”. Cập nhật tài khoản nhận donate để app tự tạo mã QR điền sẵn số tiền và mã giao dịch. Tổng donate không hiển thị công khai.", "Donations customers start in the app appear here as “Pending”, with their creation date and time; confirm once the money arrives. Update the receiving bank account so the app can generate QR codes with the amount and transaction code pre-filled. Totals are never public.")}
          </p>
          <BankInfoForm
            lang={lang}
            value={bankDraft ?? data.finance.bankInfo}
            saved={data.finance.bankInfo}
            justSaved={bankSaved}
            saveError={bankError}
            onDismissSaved={() => setBankSaved(false)}
            onChange={(next) => { setBankDraft(next); setBankSaved(false); setBankError(""); }}
            onSave={() => { if (bankDraft) setBankInfo.mutate(bankDraft); }}
            saving={setBankInfo.isPending}
          />
          <DonationList
            lang={lang}
            donations={data.finance.donations}
            onConfirm={(id) => setDonationStatus.mutate({ id, status: "confirmed" })}
            onDelete={(id) => deleteDonation.mutate(id)}
            busy={setDonationStatus.isPending || deleteDonation.isPending}
          />
        </AdminSection>
      ) : null}

      {data.content ? (
        <>
          <AdminSection title={tx(lang, "Liên hệ & mạng xã hội", "Contact & social links")} badge={data.content.contacts.length ? String(data.content.contacts.length) : undefined} open={open === "contacts"} onToggle={() => toggle("contacts")}>
            <div className="flex flex-wrap gap-1.5">
              {PLATFORM_PRESETS.map((p) => (
                <button key={p.name} type="button" className={`tabbtn ${ctPlatform === p.name ? "active" : ""}`} onClick={() => { setCtPlatform(p.name); setCtError(""); }}>
                  {p.name}
                </button>
              ))}
            </div>
            <div className="grid gap-1.5 sm:grid-cols-2">
              <label className="block">
                <span style={{ color: "var(--dim)" }}>{tx(lang, "Tên nền tảng", "Platform name")}</span>
                <input maxLength={40} required className="input" value={ctPlatform} onChange={(e) => setCtPlatform(e.target.value)} placeholder="Zalo, Threads, TikTok…" />
              </label>
              <label className="block">
                <span style={{ color: "var(--dim)" }}>{tx(lang, "Link liên kết", "Link")}</span>
                <input maxLength={300} className="input" value={ctUrl} onChange={(e) => setCtUrl(e.target.value)} placeholder={PLATFORM_PRESETS.find((p) => p.name === ctPlatform)?.hint ?? "https://…"} />
              </label>
            </div>
            {ctError ? <p style={{ color: "var(--bad)" }}>{ctError}</p> : null}
            <div>
              <button
                type="button"
                className="btn btn-orange"
                disabled={addContact.isPending}
                onClick={() => {
                  if (!ctPlatform.trim()) { setCtError(tx(lang, "Hãy chọn hoặc nhập tên nền tảng nhé.", "Pick or type a platform name.")); return; }
                  if (!/^https?:\/\//i.test(ctUrl.trim())) { setCtError(tx(lang, "Link cần bắt đầu bằng https:// nhé.", "The link must start with https://.")); return; }
                  setCtError("");
                  addContact.mutate();
                }}
              >
                <Icon name="plus" size={12} /> {tx(lang, "Thêm link liên hệ", "Add contact link")}
              </button>
            </div>
            <div className="grid gap-1">
              {data.content.contacts.map((c) => (
                <div key={c.id} className="flex items-center gap-2 border-t py-1.5" style={{ borderColor: "var(--border)" }}>
                  <ContactIcon contact={c} size={28} />
                  <span className="font-bold">{c.platform}</span>
                  <a href={c.url} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate font-semibold" style={{ color: "var(--accent)" }}>{c.url}</a>
                  <button type="button" className="btn btn-sm btn-danger" disabled={deleteContact.isPending} onClick={() => deleteContact.mutate(c.id)} aria-label={`${t(lang, "delete")}: ${c.platform}`}>
                    <Icon name="trash" size={12} />
                  </button>
                </div>
              ))}
              {data.content.contacts.length === 0 ? <p style={{ color: "var(--dim)" }}>{tx(lang, "Chưa có link liên hệ nào.", "No contact links yet.")}</p> : null}
            </div>
          </AdminSection>
        </>
      ) : null}

      {data.system ? (
        <AdminSection title={tx(lang, "Cài đặt hệ thống", "System settings")} open={open === "system"} onToggle={() => toggle("system")}>
          <label className="flex items-center gap-2">
            <span className="flex-1" style={{ color: "var(--dim)" }}>{tx(lang, "Số không gian tối đa mỗi người dùng", "Max spaces per user")}</span>
            <input
              min={1} max={100}
              type="number"
              className="input"
              style={{ width: 64 }}
              value={maxSpacesDraft ?? data.system.maxSpaces}
              onChange={(e) => setMaxSpacesDraft(Number(e.target.value))}
              aria-label={tx(lang, "Số không gian tối đa", "Max spaces")}
            />
            <button type="button" className="btn btn-orange" disabled={setMaxSpaces.isPending} onClick={() => setMaxSpaces.mutate(maxSpacesDraft ?? data.system!.maxSpaces)}>
              {t(lang, "save")}
            </button>
          </label>
          <div className="grid gap-1">
            {FEATURES.map((f) => {
              const enabled = data.system!.featureFlags[f.key] !== false;
              return (
                <label key={f.key} className="flex min-h-7 cursor-pointer items-center gap-2">
                  <input type="checkbox" className="h-4 w-4" checked={enabled} onChange={(e) => setFlag.mutate({ key: f.key, enabled: e.target.checked })} />
                  <Icon name={f.icon} size={13} />
                  <span className="flex-1 font-semibold">{FEATURE_TEXT[f.key]?.name[lang]}</span>
                  <span style={{ color: enabled ? "var(--good)" : "var(--dim)" }}>{enabled ? (tx(lang, "Đang bật", "On")) : (tx(lang, "Đang tắt", "Off"))}</span>
                </label>
              );
            })}
          </div>
        </AdminSection>
      ) : null}
    </div>
  );
}
