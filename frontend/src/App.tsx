import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { setFailureNoticeText } from "./api";
import { api } from "./api";
import { Toaster, pushToast } from "./toast";
import logoUrl from "./logo";
import {
FEATURES,
FEATURE_TEXT,
Icon,
LANGUAGES,
LEARNING_LANGUAGES,
dayKey,
fmtDate,
fmtDateTime,
fmtMoney,
t,
toLang,
vietqrUrl,
type AdminSectionId,
type Lang,
type MeData,
type PublicUser,
type SpaceItem,
type View,
} from "./lib";
import { tx, txf } from "./i18n";
import { ConfirmDialog } from "./shared";
import { ContactRow } from "./contacts";
import { CalendarView, FlashcardsView, ListeningView, NotesView, QuizView, VocabView } from "./features";
import { GoalsView, TimerView, goalStatus, goalTitle } from "./timer";
import { SettingsView } from "./settings";
import { AdminDashboard, StaffPanel, UserViewPreview, adminNavItems, type AdminPage } from "./admin";

const TOKEN_KEY = "laspace_token";
function loadToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY) ?? sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}
function storeToken(token: string, remember: boolean) {
  try {
    localStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
    (remember ? localStorage : sessionStorage).setItem(TOKEN_KEY, token);
  } catch {
    /* storage unavailable */
  }
}
function clearToken() {
  try {
    localStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage unavailable */
  }
}

// ================================================================ Starfield
// Deterministic cosmic star backdrop for the welcome screen: tiny twinkling
// stars scattered over the deep-space gradient.
function Starfield() {
  const stars = useMemo(() => {
    let seed = 20261124;
    const rnd = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    return Array.from({ length: 120 }, () => ({
      left: rnd() * 100,
      top: rnd() * 100,
      size: 1 + rnd() * 2.2,
      delay: rnd() * 4,
      dur: 2.2 + rnd() * 3.4,
      opacity: 0.35 + rnd() * 0.65,
    }));
  }, []);
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      {stars.map((s, i) => (
        <span
          key={i}
          className="star"
          style={{
            left: `${s.left}%`,
            top: `${s.top}%`,
            width: s.size,
            height: s.size,
            opacity: s.opacity,
            animationDelay: `${s.delay}s`,
            animationDuration: `${s.dur}s`,
            boxShadow: s.size > 2.4 ? "0 0 6px 1px rgba(255,255,255,0.75)" : undefined,
          }}
        />
      ))}
    </div>
  );
}

// ================================================================ Brand tagline
function BrandTagline() {
  return (
    <div className="grid justify-items-center gap-2">
      <span aria-hidden="true" style={{ width: 44, height: 3, borderRadius: 999, background: "linear-gradient(90deg,#2f6bff,#7c3aed,#ff8a3d)" }} />
      <p className="font-display text-center font-extrabold leading-snug" style={{ fontSize: 15, letterSpacing: 0.2 }}>
        <span style={{ color: "#ff8a3d" }}>LaSpace</span>
        <span style={{ opacity: 0.55 }}>{" - "}</span>
        <span
          style={{
            background: "linear-gradient(90deg,#38bdf8,#a78bfa 55%,#ff8a3d)",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            color: "transparent",
          }}
        >
          Your Language, Your Space.
        </span>
      </p>
    </div>
  );
}

// ================================================================ Auth
function AuthScreen({ onAuthed }: { onAuthed: (token: string, remember: boolean) => void }) {
  const [tab, setTab] = useState<"login" | "register" | "forgot">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [forgotSent, setForgotSent] = useState(false);
  const pubQ = useQuery({ queryKey: ["public-info"], queryFn: () => api.getPublicInfo({}) });
  const pub = pubQ.data;

  const login = useMutation({
    mutationFn: () => api.login({ email: email.trim(), password, remember }),
    onSuccess: (r) => onAuthed(r.token, remember),
    onError: (e) => setError(e.message),
  });
  const register = useMutation({
    mutationFn: () => api.register({ name: name.trim(), email: email.trim(), password, consent }),
    onSuccess: () => {
      // Back to the login form: the new user signs in with the credentials
      // they just created (no automatic login after registering).
      setTab("login");
      setPassword("");
      setError("");
      setNotice("Đăng ký thành công! Hãy đăng nhập bằng email và mật khẩu bạn vừa tạo nhé.");
    },
    onError: (e) => setError(e.message),
  });
  const forgot = useMutation({
    mutationFn: () => api.requestPasswordReset({ email: email.trim() }),
    onSuccess: () => { setForgotSent(true); setError(""); },
    onError: (e) => setError(e.message),
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setNotice("");
    if (tab === "forgot") {
      if (!email.trim()) {
        setError("Hãy nhập email của tài khoản bạn quên mật khẩu nhé.");
        return;
      }
      forgot.mutate();
      return;
    }
    if (tab === "login") {
      if (!email.trim() || !password) {
        setError("Hãy điền đầy đủ email và mật khẩu nhé — tất cả các trường đều bắt buộc.");
        return;
      }
      login.mutate();
    } else {
      if (!name.trim()) {
        setError("Hãy nhập họ và tên của bạn nhé.");
        return;
      }
      if (!email.trim() || !password) {
        setError("Hãy điền đầy đủ email và mật khẩu nhé — tất cả các trường đều bắt buộc.");
        return;
      }
      if (!consent) {
        setError("Bạn cần đồng ý cung cấp thông tin cá nhân để tiếp tục đăng ký.");
        return;
      }
      register.mutate();
    }
  };

  const authInputStyle = { background: "#171e4a", borderColor: "#2e3879", color: "#eef0ff", minHeight: 44, padding: "8px 12px" } as const;

  return (
    <div
      className="relative flex min-h-dvh flex-col items-center overflow-hidden px-4 py-10"
      style={{ background: "linear-gradient(160deg,#141b52 0%,#1e2a78 45%,#4c1d95 100%)", color: "#eef0ff" }}
    >
      <Starfield />
      <div className="relative z-10 flex w-full max-w-md flex-1 flex-col items-center justify-center gap-5">
        <div className="flex items-center justify-center gap-3">
          <img src={logoUrl} alt="Logo LaSpace" className="h-16 w-16 rounded-2xl shadow-lg" />
          <span className="font-display font-extrabold leading-none" style={{ fontSize: "clamp(34px, 10vw, 48px)", color: "#ff8a3d", letterSpacing: 0.3 }}>LaSpace</span>
        </div>
        <p className="font-display whitespace-nowrap text-center font-bold leading-tight" style={{ fontSize: "clamp(13px, 4.1vw, 19px)" }}>
          Chào mừng bạn quay lại góc học của mình
        </p>
        <h1 className="font-display text-center font-extrabold leading-[1.05]" style={{ fontSize: "clamp(28px, 8.5vw, 42px)" }}>
          Your Language,
          <br />
          <span style={{ color: "#ff8a3d" }}>Your Space.</span>
        </h1>

        <form onSubmit={submit} className="card w-full grid gap-3.5 p-5" style={{ background: "rgba(16,20,54,0.88)", borderColor: "#2e3879", color: "#eef0ff" }}>
          {tab === "forgot" ? (
            <div className="flex items-center gap-2">
              <button type="button" className="btn btn-sm btn-ghost" onClick={() => { setTab("login"); setError(""); setForgotSent(false); }} aria-label="Quay lại đăng nhập">
                <Icon name="chevL" size={13} />
              </button>
              <span className="font-display text-sm font-bold">Quên mật khẩu</span>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-1.5">
              <button type="button" className={`tabbtn ${tab === "login" ? "active" : ""}`} style={{ minHeight: 38 }} onClick={() => { setTab("login"); setError(""); setNotice(""); }}>Đăng nhập</button>
              <button type="button" className={`tabbtn ${tab === "register" ? "active" : ""}`} style={{ minHeight: 38 }} onClick={() => { setTab("register"); setError(""); setNotice(""); }}>Đăng ký</button>
            </div>
          )}
          {tab === "forgot" && forgotSent ? (
            <div className="grid gap-3">
              <p style={{ color: "#a7add8" }}>
                Đã ghi nhận yêu cầu cho email <b style={{ color: "#eef0ff" }}>{email.trim()}</b> (nếu email này có tài khoản LaSpace).
                Quản trị viên sẽ cấp cho bạn một <b style={{ color: "#eef0ff" }}>mật khẩu tạm</b> — hãy nhắn cho LaSpace qua các kênh Liên hệ ở cuối trang để nhận mật khẩu tạm,
                đăng nhập bằng mật khẩu đó rồi đổi mật khẩu mới trong mục Cài đặt nhé.
              </p>
              <button type="button" className="btn btn-orange btn-lg w-full" style={{ minHeight: 46 }} onClick={() => { setTab("login"); setForgotSent(false); setPassword(""); }}>
                Quay lại đăng nhập
              </button>
            </div>
          ) : (
            <>
              {tab === "register" ? (
                <label className="grid gap-1.5">
                  <span style={{ color: "#a7add8" }}>Họ và tên</span>
                  <input maxLength={80} required className="input" style={authInputStyle} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" placeholder="Tên của bạn" />
                </label>
              ) : null}
              <label className="grid gap-1.5">
                <span style={{ color: "#a7add8" }}>Email</span>
                <input maxLength={120} type="email" className="input" style={authInputStyle} value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" placeholder="ban@email.com" />
              </label>
              {tab !== "forgot" ? (
                <label className="grid gap-1.5">
                  <span style={{ color: "#a7add8" }}>Mật khẩu</span>
                  <input maxLength={100} type="password" className="input" style={authInputStyle} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={tab === "login" ? "current-password" : "new-password"} placeholder="••••••••" />
                </label>
              ) : null}
              {tab === "login" ? (
                <div className="flex min-h-9 items-center gap-2">
                  <label className="flex cursor-pointer items-center gap-2">
                    <input type="checkbox" className="h-4 w-4" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
                    Nhớ đăng nhập
                  </label>
                  <button type="button" className="ml-auto font-semibold underline" style={{ color: "#ff8a3d" }} onClick={() => { setTab("forgot"); setError(""); setNotice(""); setForgotSent(false); }}>
                    Quên mật khẩu?
                  </button>
                </div>
              ) : tab === "register" ? (
                <label className="flex min-h-9 cursor-pointer items-center gap-2" style={{ fontSize: 10, lineHeight: 1.3, color: "#a7add8" }}>
                  <input type="checkbox" className="h-4 w-4 shrink-0" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
                  <span>Tôi đồng ý cung cấp thông tin cá nhân để cá nhân hoá trải nghiệm học tập của tôi. *</span>
                </label>
              ) : (
                <p style={{ color: "#a7add8" }}>
                  Nhập email của tài khoản bạn quên mật khẩu. Quản trị viên sẽ cấp mật khẩu tạm để bạn đăng nhập lại.
                </p>
              )}
              {notice ? <p style={{ color: "#34d399" }}>{notice}</p> : null}
              {error ? <p style={{ color: "#fb7185" }}>{error}</p> : null}
              <button type="submit" className="btn btn-orange btn-lg w-full" style={{ minHeight: 46 }} disabled={login.isPending || register.isPending || forgot.isPending}>
                {tab === "login" ? "Đăng nhập" : tab === "register" ? "Đăng ký" : "Gửi yêu cầu đặt lại mật khẩu"}
              </button>
            </>
          )}
        </form>

        {pub ? (
          <div className="grid w-full gap-3">
            <div
              className="grid gap-2 rounded-2xl p-3"
              style={{
                background: "linear-gradient(140deg, rgba(47,107,255,0.28), rgba(124,58,237,0.28) 55%, rgba(255,138,61,0.25))",
                border: "1px solid rgba(167,173,216,0.45)",
                boxShadow: "0 10px 30px rgba(5,8,25,0.45)",
              }}
            >
              <p className="font-display text-center text-sm font-extrabold tracking-wide" style={{ color: "#eef0ff" }}>
                Cộng đồng LaSpace đang lớn lên mỗi ngày
              </p>
              {/* Stats in one horizontal row: Người dùng (hero, gold), Đánh giá 5 sao, Lượt tải. */}
              <div className={`grid gap-2 ${pub.showcase.downloads != null ? "grid-cols-3" : "grid-cols-2"}`}>
                <div
                  className="grid content-center justify-items-center gap-1 rounded-xl px-2 py-3 text-center"
                  style={{
                    background: "linear-gradient(160deg, rgba(255,138,61,0.30), rgba(124,58,237,0.34) 60%, rgba(47,107,255,0.30))",
                    border: "1.5px solid rgba(255,209,102,0.75)",
                    boxShadow: "0 0 26px rgba(255,138,61,0.45), inset 0 0 18px rgba(255,209,102,0.14)",
                  }}
                >
                  <span style={{ color: "#ffd166", filter: "drop-shadow(0 0 6px rgba(255,209,102,0.8))" }}>
                    <Icon name="users" size={24} />
                  </span>
                  <p
                    className="font-display font-extrabold leading-none"
                    style={{ fontSize: pub.showcase.downloads != null ? 30 : 38, color: "#ffd166", textShadow: "0 0 22px rgba(255,138,61,0.85), 0 2px 6px rgba(0,0,0,0.45)" }}
                  >
                    {pub.showcase.users.toLocaleString("vi-VN")}{pub.showcase.users >= 100 ? "+" : ""}
                  </p>
                  <p className="font-display font-bold uppercase" style={{ fontSize: 12, letterSpacing: 2, color: "#fff" }}>
                    Người dùng
                  </p>
                </div>
                <div className="grid content-center justify-items-center gap-1 rounded-xl px-1 py-3 text-center" style={{ background: "rgba(12,16,44,0.72)", border: "1px solid rgba(167,173,216,0.35)" }}>
                  <span style={{ color: "#ffd166", filter: "drop-shadow(0 0 5px rgba(255,209,102,0.7))" }}><Icon name="star" size={18} /></span>
                  <p className="font-display font-extrabold leading-none" style={{ fontSize: pub.showcase.downloads != null ? 22 : 26, color: "#ffd166" }}>
                    {pub.showcase.fiveStar.toLocaleString("vi-VN")}{pub.showcase.fiveStar >= 100 ? "+" : ""}
                  </p>
                  <p className="font-display font-bold uppercase" style={{ fontSize: 11, letterSpacing: 1, color: "#a7add8" }}>Đánh giá 5 sao</p>
                </div>
                {pub.showcase.downloads != null ? (
                  <div className="grid content-center justify-items-center gap-1 rounded-xl px-1 py-3 text-center" style={{ background: "rgba(12,16,44,0.72)", border: "1px solid rgba(167,173,216,0.35)" }}>
                    <span style={{ color: "#ff8a3d" }}><Icon name="download" size={18} /></span>
                    <p className="font-display font-extrabold leading-none" style={{ fontSize: 18, color: "#fff" }}>
                      {pub.showcase.downloads.toLocaleString("vi-VN")}{pub.showcase.downloads >= 100 ? "+" : ""}
                    </p>
                    <p className="font-display font-bold uppercase" style={{ fontSize: 12, letterSpacing: 2, color: "#a7add8" }}>Lượt tải</p>
                  </div>
                ) : null}
              </div>
            </div>
            <ContactRow contacts={pub.contacts} label="Liên hệ với LaSpace" dark />
          </div>
        ) : null}
      </div>
      <div className="relative z-10 pb-2 pt-8">
        <BrandTagline />
      </div>
    </div>
  );
}

// ================================================================ Sidebar
function SidebarContent(props: {
  token: string;
  lang: Lang;
  user: PublicUser;
  view: View;
  setView: (v: View) => void;
  spaces: SpaceItem[];
  maxSpaces: number;
  activeSpaceId: number | null;
  onOpenSpace: (id: number) => void;
  onLogout: () => void;
  closeMobile: () => void;
}) {
  const { lang, user } = props;
  const L = lang === "vi";
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [createError, setCreateError] = useState("");
  const [menuFor, setMenuFor] = useState<number | null>(null);
  const [renaming, setRenaming] = useState<number | null>(null);
  const [renameText, setRenameText] = useState("");
  const [renameError, setRenameError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<SpaceItem | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["spaces"] });
  const createSpace = useMutation({
    mutationFn: () => api.createSpace({ token: props.token, name: newName.trim() }),
    onSuccess: (r) => {
      invalidate();
      setCreating(false);
      setNewName("");
      props.onOpenSpace(r.id);
    },
    onError: (e) => setCreateError(e.message),
  });
  const renameSpace = useMutation({
    mutationFn: (args: { id: number; name: string }) => api.renameSpace({ token: props.token, spaceId: args.id, name: args.name }),
    onSuccess: () => { invalidate(); setRenaming(null); setMenuFor(null); },
  });
  const deleteSpace = useMutation({
    mutationFn: (id: number) => api.deleteSpace({ token: props.token, spaceId: id }),
    onSuccess: () => { invalidate(); setConfirmDelete(null); setMenuFor(null); },
  });

  // Admin page badges in the sidebar (donate totals, pending resets,
  // contact/user counts) share the admin pages' query cache.
  const adminQ = useQuery({
    queryKey: ["admin"],
    queryFn: () => api.adminOverview({ token: props.token }),
    enabled: user.role === "admin",
  });
  const resetsQ = useQuery({
    queryKey: ["password-resets"],
    queryFn: () => api.adminListPasswordResets({ token: props.token }),
    enabled: user.role === "admin",
  });

  const nav = (v: View) => {
    props.setView(v);
    props.closeMobile();
  };

  return (
    <div className="flex h-full flex-col gap-1">
      <div className="flex flex-col items-center gap-1.5 px-1 pb-3 pt-1 text-center">
        <img src={logoUrl} alt="Logo LaSpace" className="h-14 w-14 rounded-2xl" />
        <span className="font-display text-2xl font-extrabold leading-none" style={{ color: "var(--accent)" }}>LaSpace</span>
      </div>

      <button type="button" className={`navbtn ${props.view === "home" ? "active" : ""}`} onClick={() => nav("home")} title={tx(lang, "Trang chính: tiến độ học, mục tiêu và ủng hộ LaSpace", "Home: study progress, goals and donations")}>
        <Icon name="home" /> {t(lang, "home")}
      </button>
      <button type="button" className={`navbtn ${props.view === "store" ? "active" : ""}`} onClick={() => nav("store")} title={tx(lang, "Kho tính năng: chọn tính năng để thêm vào không gian của bạn", "Feature store: pick features to add to your spaces")}>
        <Icon name="grid" /> <span className="flex-1">{t(lang, "store")}</span>
        {user.role === "admin" ? <span className="chip chip-orange">Admin</span> : null}
      </button>
      <button type="button" className={`navbtn ${props.view === "settings" ? "active" : ""}`} onClick={() => nav("settings")} title={tx(lang, "Cài đặt: hồ sơ, mật khẩu, ngôn ngữ, giao diện và Google Sheet", "Settings: profile, password, language, theme and Google Sheet")}>
        <Icon name="gear" /> {t(lang, "settings")}
      </button>

      {user.role === "admin" ? (
        <>
          <p className="px-2 pb-0.5 pt-3 font-bold tracking-wide" style={{ color: "var(--dim)", fontSize: 10 }}>{t(lang, "adminSection")}</p>
          <button type="button" className={`navbtn ${props.view === "admin" ? "active" : ""}`} onClick={() => nav("admin")} title={tx(lang, "Dashboard Admin: chỉ hiển thị dữ liệu hệ thống", "Admin dashboard: system data only")}>
            <Icon name="shield" /> <span className="flex-1">{t(lang, "adminDash")}</span>
          </button>
          {adminQ.data
            ? adminNavItems(lang, adminQ.data, resetsQ.data?.requests.length ?? 0).map((item) => {
                const v: View = `admin-${item.id}`;
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`navbtn ${props.view === v ? "active" : ""}`}
                    onClick={() => nav(v)}
                    aria-current={props.view === v ? "page" : undefined}
                    title={item.hint}
                  >
                    <Icon name={item.icon} size={14} />
                    <span className="flex-1">{item.label}</span>
                    {item.badge ? <span className="chip chip-orange">{item.badge}</span> : null}
                  </button>
                );
              })
            : null}
        </>
      ) : user.permissions.length > 0 ? (
        <button type="button" className={`navbtn ${props.view === "staff" ? "active" : ""}`} onClick={() => nav("staff")} title={tx(lang, "Phần việc quản trị bạn được cấp quyền", "The admin work you have been granted")}>
          <Icon name="shield" /> {tx(lang, "Khu vực được phân quyền", "Your granted area")}
        </button>
      ) : null}

      <p className="px-2 pb-0.5 pt-3 font-bold tracking-wide" style={{ color: "var(--dim)", fontSize: 10 }}>{t(lang, "mySpaces")}</p>
      <div className="grid gap-0.5">
        {props.spaces.map((s) => (
          <div key={s.id} className="relative">
            <div className={`navbtn ${props.view === "space" && props.activeSpaceId === s.id ? "active" : ""}`} style={{ paddingRight: 2 }}>
              <button
                type="button"
                className="flex min-w-0 flex-1 items-center gap-2 text-left"
                onClick={() => { props.onOpenSpace(s.id); props.closeMobile(); }}
              >
                <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: "linear-gradient(135deg,#2f6bff,#7c3aed)" }} />
                <span className="flex-1 truncate">{s.name}</span>
                <span style={{ color: "var(--dim)" }}>{s.wordCount} {t(lang, "words")}</span>
              </button>
              <button
                type="button"
                className="btn btn-sm btn-ghost"
                style={{ minHeight: 22, padding: "0 4px" }}
                onClick={() => setMenuFor(menuFor === s.id ? null : s.id)}
                aria-label={`${t(lang, "rename")} / ${t(lang, "deleteSpace")}: ${s.name}`}
                aria-expanded={menuFor === s.id}
              >
                <Icon name="dots" size={13} />
              </button>
            </div>
            {menuFor === s.id ? (
              <div className="card absolute left-0 right-0 top-full z-20 mt-0.5 grid gap-1 p-1.5 shadow-lg">
                {renaming === s.id ? (
                  <div className="grid gap-1">
                    <div className="flex gap-1">
                      <input maxLength={60} required className="input" value={renameText} onChange={(e) => setRenameText(e.target.value)} aria-label={t(lang, "rename")} autoFocus />
                      <button
                        type="button"
                        className="btn btn-sm btn-orange"
                        onClick={() => {
                          if (!renameText.trim()) {
                            setRenameError(tx(lang, "Hãy nhập tên mới cho không gian nhé.", "Enter a new name for the space."));
                            return;
                          }
                          setRenameError("");
                          renameSpace.mutate({ id: s.id, name: renameText.trim() });
                        }}
                      >
                        {t(lang, "save")}
                      </button>
                    </div>
                    {renameError ? <p style={{ color: "var(--bad)" }}>{renameError}</p> : null}
                  </div>
                ) : (
                  <>
                    <button type="button" className="btn btn-sm justify-start" onClick={() => { setRenaming(s.id); setRenameText(s.name); }}>
                      <Icon name="edit" size={12} /> {t(lang, "rename")}
                    </button>
                    <button type="button" className="btn btn-sm btn-danger justify-start" onClick={() => setConfirmDelete(s)}>
                      <Icon name="trash" size={12} /> {t(lang, "deleteSpace")}
                    </button>
                  </>
                )}
              </div>
            ) : null}
          </div>
        ))}
      </div>

      {creating ? (
        <div className="grid gap-1 px-1 pt-1">
          <input
            maxLength={60} required
            className="input"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={tx(lang, "Tên không gian…", "Space name…")}
            aria-label={tx(lang, "Tên không gian", "Space name")}
            autoFocus
          />
          {createError ? <p style={{ color: "var(--bad)" }}>{createError}</p> : null}
          <div className="flex gap-1">
            <button
              type="button"
              className="btn btn-sm btn-orange"
              disabled={createSpace.isPending}
              onClick={() => {
                if (!newName.trim()) {
                  setCreateError(tx(lang, "Hãy đặt tên cho không gian nhé.", "Name your space first."));
                  return;
                }
                setCreateError("");
                createSpace.mutate();
              }}
            >
              {tx(lang, "Tạo", "Create")}
            </button>
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => setCreating(false)}>{t(lang, "cancel")}</button>
          </div>
        </div>
      ) : (
        <button type="button" className="navbtn" onClick={() => setCreating(true)} title={tx(lang, "Tạo một không gian học riêng mới", "Create a new personal learning space")}>
          <Icon name="plus" /> <span className="flex-1">{t(lang, "createSpace")}</span>
          <span style={{ color: "var(--dim)" }}>{props.spaces.length}/{props.maxSpaces}</span>
        </button>
      )}

      <div className="mt-auto flex items-center gap-2 border-t px-1 pt-2" style={{ borderColor: "var(--border)" }}>
        {user.avatarUrl ? (
          <img src={user.avatarUrl} alt="" className="h-7 w-7 shrink-0 rounded-full object-cover" />
        ) : (
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-bold text-white" style={{ background: "linear-gradient(135deg,#2f6bff,#7c3aed)" }}>
            {user.name.charAt(0).toUpperCase()}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold leading-tight">{user.name}</p>
          <p className="truncate leading-tight" style={{ color: "var(--dim)" }}>{user.role === "admin" ? t(lang, "adminAccount") : user.guest ? t(lang, "guestAccount") : t(lang, "userAccount")}</p>
        </div>
        <button type="button" className="btn btn-sm btn-danger" onClick={props.onLogout} aria-label={t(lang, "logout")} title={tx(lang, "Đăng xuất khỏi tài khoản này", "Sign out of this account")}>
          <Icon name="logout" size={13} /> {t(lang, "logout")}
        </button>
      </div>

      {confirmDelete ? (
        <ConfirmDialog
          lang={lang}
          message={t(lang, "confirmDeleteSpace")}
          confirmLabel={t(lang, "delete")}
          onConfirm={() => deleteSpace.mutate(confirmDelete.id)}
          onCancel={() => setConfirmDelete(null)}
        />
      ) : null}
    </div>
  );
}

// ================================================================ Donate
// Pressing Donate creates a pending donation with an auto transaction code
// (default 50.000 ₫); it appears in the admin dashboard immediately and the
// donor quotes the code in their bank-transfer note.
function DonateCard({
  token,
  lang,
  bankInfo,
}: {
  token: string;
  lang: Lang;
  bankInfo: { bank: string; bankBin: string; account: string; holder: string };
}) {
  const L = lang === "vi";
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState("50000");
  const [error, setError] = useState("");
  const [created, setCreated] = useState<{ code: string; amount: number } | null>(null);
  const mineQ = useQuery({ queryKey: ["my-donations"], queryFn: () => api.listMyDonations({ token }) });
  const create = useMutation({
    mutationFn: () => api.createDonation({ token, amount: Number(amount) }),
    onSuccess: (r) => {
      setCreated({ code: r.code, amount: r.amount });
      setError("");
      queryClient.invalidateQueries({ queryKey: ["my-donations"] });
    },
    onError: (e) => setError(e.message),
  });
  const mine = mineQ.data?.donations ?? [];

  return (
    <section className="grid gap-2">
      <h2 className="font-display flex items-center gap-1.5 text-sm font-bold">
        <span style={{ color: "var(--accent)" }}><Icon name="heart" size={14} /></span>
        {tx(lang, "Ủng hộ LaSpace", "Support LaSpace")}
      </h2>
      <div className="card grid gap-2 p-3" style={{ background: "linear-gradient(120deg, rgba(47,107,255,0.14), rgba(255,138,61,0.14))" }}>
        {created ? (
          <div className="grid gap-2 text-center">
            <p className="font-semibold">{tx(lang, "Mã giao dịch của bạn", "Your transaction code")}</p>
            <p className="font-display rounded-xl border border-dashed px-3 py-2 font-extrabold tracking-widest" style={{ fontSize: 22, color: "var(--accent)", borderColor: "var(--accent)", background: "var(--surface)" }}>
              {created.code}
            </p>
            <p>
              {tx(lang, "Số tiền: ", "Amount: ")}<b>{fmtMoney(created.amount)}</b>
            </p>
            {(() => {
              const qr = vietqrUrl(bankInfo, created.amount, created.code);
              return qr ? (
                <div className="grid justify-items-center gap-1">
                  <img
                    src={qr}
                    alt={tx(lang, "Mã QR chuyển khoản donate", "Donation transfer QR code")}
                    className="w-full max-w-60 rounded-xl"
                    style={{ background: "#fff" }}
                    loading="lazy"
                  />
                  <p style={{ color: "var(--dim)" }}>
                    {tx(lang, "Mở app ngân hàng và quét mã QR này — số tiền và mã giao dịch đã được điền sẵn, bạn chỉ cần bấm chuyển.", "Open your banking app and scan this QR — the amount and transaction code are pre-filled, just press transfer.")}
                  </p>
                </div>
              ) : null;
            })()}
            {bankInfo.account ? (
              <p style={{ color: "var(--dim)" }}>
                {tx(lang, "Chuyển khoản tới", "Transfer to")}: <b style={{ color: "var(--text)" }}>{bankInfo.bank} · {bankInfo.account} · {bankInfo.holder}</b>
              </p>
            ) : null}
            <p style={{ color: "var(--dim)" }}>
              {tx(lang, "Ghi đúng mã này vào nội dung chuyển khoản nhé. Khoản donate đã được hệ thống ghi nhận, admin sẽ xác nhận khi tiền về.", "Put this exact code in your transfer note. Your donation is recorded; an admin confirms it once the money arrives.")}
            </p>
            <div>
              <button type="button" className="btn" onClick={() => setCreated(null)}>
                {tx(lang, "Tạo mã mới", "New code")}
              </button>
            </div>
          </div>
        ) : (
          <>
            <p style={{ color: "var(--dim)" }}>
              {tx(lang, "LaSpace miễn phí cho mọi người. Nếu app giúp ích cho bạn, hãy ủng hộ một chút để app tiếp tục phát triển nhé.", "LaSpace is free for everyone. If it helps you, a small donation keeps it growing.")}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {[10000, 20000, 30000, 50000, 100000, 200000, 500000].map((n) => (
                <button
                  key={n}
                  type="button"
                  className={`tabbtn ${Number(amount) === n ? "active" : ""}`}
                  onClick={() => setAmount(String(n))}
                  title={txf(lang, "Chọn nhanh {0}", "Quick pick {0}", fmtMoney(n))}
                >
                  {fmtMoney(n)}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <input
                min={1000} max={1000000000}
                type="number"
                className="input"
                style={{ width: 130 }}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                aria-label={tx(lang, "Số tiền donate (VNĐ)", "Donation amount (VND)")}
              />
              <button
                type="button"
                className="btn btn-orange"
                disabled={create.isPending}
                title={tx(lang, "Tạo mã giao dịch donate và mã QR chuyển khoản", "Create a donation transaction code and transfer QR")}
                onClick={() => {
                  const n = Number(amount);
                  if (!Number.isFinite(n) || n < 1000) {
                    setError(tx(lang, "Số tiền donate tối thiểu là 1.000 ₫ nhé.", "The minimum donation is 1,000 ₫."));
                    return;
                  }
                  setError("");
                  create.mutate();
                }}
              >
                <Icon name="heart" size={13} /> Donate
              </button>
            </div>
            {error ? <p style={{ color: "var(--bad)" }}>{error}</p> : null}
          </>
        )}
        {mine.length ? (
          <div className="grid gap-1 border-t pt-2" style={{ borderColor: "var(--border)" }}>
            <p className="font-bold">{tx(lang, "Donate của bạn", "Your donations")}</p>
            {mine.slice(0, 4).map((d) => (
              <div key={d.id} className="grid gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{d.code}</span>
                  <span style={{ color: "var(--accent)" }} className="font-bold">{fmtMoney(d.amount)}</span>
                  <span className={`chip ${d.status === "confirmed" ? "chip-violet" : "chip-orange"}`}>
                    {d.status === "confirmed" ? (tx(lang, "Đã nhận", "Received")) : (tx(lang, "Chờ xác nhận", "Pending"))}
                  </span>
                  <span className="ml-auto" style={{ color: "var(--dim)" }}>{fmtDateTime(d.createdAt, lang)}</span>
                </div>
                {d.status === "pending" ? (() => {
                  const qr = vietqrUrl(bankInfo, d.amount, d.code);
                  return qr ? (
                    <details>
                      <summary className="cursor-pointer font-semibold" style={{ color: "var(--accent)" }}>
                        {tx(lang, "Hiện mã QR để chuyển khoản", "Show the QR to transfer")}
                      </summary>
                      <img src={qr} alt={tx(lang, "Mã QR chuyển khoản donate", "Donation transfer QR code")} className="mt-1 w-full max-w-52 rounded-xl" style={{ background: "#fff" }} loading="lazy" />
                    </details>
                  ) : null;
                })() : null}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}

// ================================================================ Home
function HomeView({
  token,
  lang,
  userName,
  spaces,
  maxSpaces,
  bankInfo,
  donateEnabled,
  onOpenSpace,
  onGoStore,
}: {
  token: string;
  lang: Lang;
  userName: string;
  spaces: SpaceItem[];
  maxSpaces: number;
  bankInfo: { bank: string; bankBin: string; account: string; holder: string };
  donateEnabled: boolean;
  onOpenSpace: (id: number) => void;
  onGoStore: () => void;
}) {
  const L = lang === "vi";
  const sessionsQ = useQuery({ queryKey: ["sessions", "all"], queryFn: () => api.listStudySessions({ token }) });
  const goalsQ = useQuery({ queryKey: ["goals"], queryFn: () => api.listGoals({ token }) });
  const sessions = sessionsQ.data?.sessions ?? [];
  const goals = goalsQ.data?.goals ?? [];

  const total = sessions.reduce((s, x) => s + x.minutes, 0);
  const today = sessions.filter((s) => dayKey(s.completedAt) === dayKey(new Date().toISOString())).reduce((s, x) => s + x.minutes, 0);
  const weekAgo = Date.now() - 7 * 86_400_000;
  const last7 = sessions.filter((s) => new Date(s.completedAt).getTime() >= weekAgo).reduce((s, x) => s + x.minutes, 0);
  const doneGoals = goals.filter((g) => g.progress >= g.target).length;
  const avg = goals.length ? Math.round(goals.reduce((s, g) => s + Math.min(100, (g.progress / Math.max(1, g.target)) * 100), 0) / goals.length) : 0;

  const stat = (label: string, value: string) => (
    <div className="card p-2.5 text-center">
      <p className="font-display text-base font-extrabold">{value}</p>
      <p style={{ color: "var(--dim)" }}>{label}</p>
    </div>
  );

  return (
    <div className="grid gap-4">
      <div className="greeting-banner">
        <span className="star" style={{ left: "6%", top: "22%", width: 3, height: 3, animationDuration: "2.6s" }} />
        <span className="star" style={{ left: "88%", top: "18%", width: 2.5, height: 2.5, animationDuration: "3.4s", animationDelay: "0.7s" }} />
        <span className="star" style={{ left: "72%", top: "68%", width: 2, height: 2, animationDuration: "2.2s", animationDelay: "1.2s" }} />
        <span className="star" style={{ left: "38%", top: "14%", width: 2, height: 2, animationDuration: "3s", animationDelay: "0.4s" }} />
        <p className="font-display relative font-extrabold leading-snug" style={{ fontSize: 16 }}>
          {(() => {
            const parts = tx(lang, "Chào mừng {name} đã trở lại không gian, Cố gắng hoàn thành mục tiêu nhé 🎉", "Welcome back to your space, {name} — keep pushing to finish your goals 🎉").split("{name}");
            return (
              <>
                {parts[0]}
                <span className="greeting-name">{userName}</span>
                {parts[1] ?? ""}
              </>
            );
          })()}
        </p>
      </div>

      <section className="grid gap-2">
        <h2 className="font-display text-sm font-bold">{t(lang, "studyStats")}</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {stat(t(lang, "totalStudy"), `${total} ${t(lang, "minutes")}`)}
          {stat(t(lang, "today"), `${today} ${t(lang, "minutes")}`)}
          {stat(t(lang, "last7"), `${last7} ${t(lang, "minutes")}`)}
          {stat(t(lang, "sessionsDone"), String(sessions.length))}
          {stat(t(lang, "goalsDone"), `${doneGoals}/${goals.length}`)}
          {stat(t(lang, "avgProgress"), `${avg}%`)}
        </div>
        {goals.slice(0, 3).map((g) => {
          const st = goalStatus(g, lang);
          return (
            <div key={g.id} className="card grid gap-1 px-2.5 py-2">
              <div className="flex items-center gap-2">
                <span className="flex-1 font-bold">{goalTitle(g, lang)}</span>
                <span className={`chip ${st.done ? "chip-orange" : "chip-violet"}`}>{st.label}</span>
                <span className="font-bold">{st.pct}%</span>
              </div>
              <div className="progress-track"><div className="progress-fill" style={{ width: `${st.pct}%` }} /></div>
            </div>
          );
        })}
      </section>

      <section className="grid gap-2">
        <h2 className="font-display text-sm font-bold">{t(lang, "mySpaces")}</h2>
        <p style={{ color: "var(--dim)" }}>
          {tx(lang, "Tổng số không gian của bạn:", "Your total spaces:")}{" "}
          <b style={{ color: "var(--text)" }}>{spaces.length}</b> / {maxSpaces}
        </p>
        {spaces.length === 0 ? (
          <div className="card grid gap-2 p-3 text-center">
            <p style={{ color: "var(--dim)" }}>{t(lang, "noSpacesYet")}</p>
            <div>
              <button type="button" className="btn btn-orange" onClick={onGoStore} title={tx(lang, "Tới Kho tính năng để tạo không gian đầu tiên", "Go to the feature store to create your first space")}>
                <Icon name="plus" size={13} /> {t(lang, "createSpace")}
              </button>
            </div>
          </div>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {spaces.map((s) => (
              <button key={s.id} type="button" className="card grid gap-1 p-3 text-left" onClick={() => onOpenSpace(s.id)}>
                <span className="font-display text-sm font-bold">{s.name}</span>
                <span style={{ color: "var(--dim)" }}>
                  {s.wordCount} {t(lang, "words")} · {s.features.length} {tx(lang, "tính năng", "features")} · {fmtDate(s.createdAt, lang)}
                </span>
                <span className="font-semibold" style={{ color: "var(--accent)" }}>{t(lang, "openSpace")} →</span>
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="grid gap-2">
        <h2 className="font-display text-sm font-bold">{tx(lang, "Mục tiêu học tập", "Learning goals")}</h2>
        <GoalsView token={token} lang={lang} />
      </section>

      {donateEnabled ? <DonateCard token={token} lang={lang} bankInfo={bankInfo} /> : null}
    </div>
  );
}

// ================================================================ Store
function StoreView({
  token,
  lang,
  spaces,
  flags,
  activeSpaceId,
  setActiveSpaceId,
}: {
  token: string;
  lang: Lang;
  spaces: SpaceItem[];
  flags: Record<string, boolean>;
  activeSpaceId: number | null;
  setActiveSpaceId: (id: number) => void;
}) {
  const L = lang === "vi";
  const queryClient = useQueryClient();
  const [newSpaceName, setNewSpaceName] = useState("");
  const [newSpaceError, setNewSpaceError] = useState("");
  const createSpace = useMutation({
    mutationFn: () => api.createSpace({ token, name: newSpaceName.trim() }),
    onSuccess: (r) => {
      queryClient.invalidateQueries({ queryKey: ["spaces"] });
      setActiveSpaceId(r.id);
      setNewSpaceName("");
    },
    onError: (e) => setNewSpaceError(e.message),
  });
  const target = spaces.find((s) => s.id === activeSpaceId) ?? spaces[0];
  const add = useMutation({
    mutationFn: (key: string) => api.addFeatureToSpace({ token, spaceId: target?.id ?? 0, featureKey: key as "flashcards" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["spaces"] }),
  });
  const remove = useMutation({
    mutationFn: (key: string) => api.removeFeatureFromSpace({ token, spaceId: target?.id ?? 0, featureKey: key as "flashcards" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["spaces"] }),
  });

  return (
    <div className="grid gap-3">
      <h2 className="font-display text-base font-extrabold">{t(lang, "store")}</h2>
      <p style={{ color: "var(--dim)" }}>{t(lang, "storeIntro")}</p>
      {spaces.length === 0 ? (
        <div className="card grid gap-2 p-3">
          <p style={{ color: "var(--dim)" }}>{t(lang, "pickSpaceFirst")}</p>
          <div className="flex gap-1.5">
            <input
              maxLength={60} required
              className="input"
              value={newSpaceName}
              onChange={(e) => setNewSpaceName(e.target.value)}
              placeholder={tx(lang, "Tên không gian…", "Space name…")}
              aria-label={tx(lang, "Tên không gian", "Space name")}
            />
            <button
              type="button"
              className="btn btn-orange"
              disabled={createSpace.isPending}
              onClick={() => {
                if (!newSpaceName.trim()) {
                  setNewSpaceError(tx(lang, "Hãy đặt tên cho không gian nhé.", "Name your space first."));
                  return;
                }
                setNewSpaceError("");
                createSpace.mutate();
              }}
            >
              {tx(lang, "Tạo", "Create")}
            </button>
          </div>
          {newSpaceError ? <p style={{ color: "var(--bad)" }}>{newSpaceError}</p> : null}
        </div>
      ) : (
        <>
          <label className="flex items-center gap-2">
            <span style={{ color: "var(--dim)" }}>{tx(lang, "Thêm vào không gian:", "Add into space:")}</span>
            <select
              className="input"
              style={{ width: 200 }}
              value={target?.id ?? ""}
              onChange={(e) => setActiveSpaceId(Number(e.target.value))}
              aria-label={tx(lang, "Chọn không gian", "Pick a space")}
            >
              {spaces.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </label>
          <div className="grid gap-2 sm:grid-cols-2">
            {FEATURES.map((f) => {
              const meta = FEATURE_TEXT[f.key];
              if (!meta) return null;
              const off = flags[f.key] === false;
              const added = target?.features.includes(f.key) ?? false;
              return (
                <div key={f.key} className="card grid gap-1.5 p-3">
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg text-white" style={{ background: "linear-gradient(135deg,#2f6bff,#7c3aed)" }}>
                      <Icon name={f.icon} size={14} />
                    </span>
                    <span className="font-display flex-1 text-sm font-bold">{meta.name[lang]}</span>
                    {off ? <span className="chip">{t(lang, "featureOff")}</span> : null}
                  </div>
                  <p style={{ color: "var(--dim)" }}>{meta.desc[lang]}</p>
                  {added ? (
                    <div className="flex gap-1.5">
                      <span className="chip chip-orange">{t(lang, "added")} ✓</span>
                      <button type="button" className="btn btn-sm btn-danger" onClick={() => remove.mutate(f.key)} disabled={remove.isPending} aria-label={`${t(lang, "removeFeature")}: ${meta.name[lang]}`}>
                        {t(lang, "removeFeature")}
                      </button>
                    </div>
                  ) : (
                    <div>
                      <button type="button" className="btn btn-sm btn-orange" onClick={() => add.mutate(f.key)} disabled={off || add.isPending} aria-label={`${t(lang, "addToSpace")}: ${meta.name[lang]}`}>
                        <Icon name="plus" size={12} /> {t(lang, "addToSpace")}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// ================================================================ Space view
function SpaceView({
  token,
  lang,
  user,
  space,
  flags,
  onUserChange,
  onGoStore,
}: {
  token: string;
  lang: Lang;
  user: PublicUser;
  space: SpaceItem;
  flags: Record<string, boolean>;
  onUserChange: (u: PublicUser) => void;
  onGoStore: () => void;
}) {
  const L = lang === "vi";
  const queryClient = useQueryClient();
  const available = space.features.filter((k) => flags[k] !== false);
  const [activeFeature, setActiveFeature] = useState<string>("");
  const [featureMenuOpen, setFeatureMenuOpen] = useState(false);
  const current = available.includes(activeFeature) ? activeFeature : (available[0] ?? "");
  const remove = useMutation({
    mutationFn: (key: string) => api.removeFeatureFromSpace({ token, spaceId: space.id, featureKey: key as "flashcards" }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["spaces"] }); setFeatureMenuOpen(false); },
  });

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-display flex-1 text-base font-extrabold">{space.name}</h2>
        <button type="button" className="btn btn-sm" onClick={onGoStore}>
          <Icon name="plus" size={12} /> {tx(lang, "Thêm tính năng", "Add feature")}
        </button>
      </div>
      {available.length === 0 ? (
        <p className="card p-3" style={{ color: "var(--dim)" }}>{t(lang, "noFeaturesYet")}</p>
      ) : (
        <>
          <div className="flex items-start gap-1.5">
            <div className="flex min-w-0 flex-1 flex-wrap gap-1.5" role="tablist" aria-label={t(lang, "spaceFeatures")}>
              {available.map((k) => {
                const meta = FEATURE_TEXT[k];
                const f = FEATURES.find((x) => x.key === k);
                return (
                  <button
                    key={k}
                    type="button"
                    role="tab"
                    aria-selected={current === k}
                    className={`tabbtn inline-flex items-center gap-1.5 ${current === k ? "active" : ""}`}
                    onClick={() => { setActiveFeature(k); setFeatureMenuOpen(false); }}
                    title={meta?.desc[lang] ?? ""}
                  >
                    {f ? <Icon name={f.icon} size={13} /> : null} {meta?.name[lang] ?? k}
                  </button>
                );
              })}
            </div>
            <div className="relative shrink-0">
              <button
                type="button"
                className="btn btn-sm"
                style={{ minHeight: 26, padding: "0 6px" }}
                onClick={() => setFeatureMenuOpen((v) => !v)}
                aria-label={`${tx(lang, "Tùy chọn tính năng", "Feature options")}: ${FEATURE_TEXT[current]?.name[lang] ?? current}`}
                aria-expanded={featureMenuOpen}
              >
                <Icon name="dots" size={14} />
              </button>
              {featureMenuOpen ? (
                <div className="card absolute right-0 top-full z-20 mt-1 grid min-w-52 gap-1 p-1.5 shadow-lg">
                  <button
                    type="button"
                    className="btn btn-sm btn-danger justify-start"
                    onClick={() => remove.mutate(current)}
                    disabled={remove.isPending}
                  >
                    <Icon name="trash" size={12} /> {t(lang, "removeFeature")}: {FEATURE_TEXT[current]?.name[lang] ?? current}
                  </button>
                </div>
              ) : null}
            </div>
          </div>
          <div key={`${space.id}-${current}`}>
            {current === "flashcards" ? <FlashcardsView token={token} lang={lang} spaceId={space.id} /> : null}
            {current === "vocab" ? <VocabView token={token} lang={lang} spaceId={space.id} /> : null}
            {current === "notes" ? <NotesView token={token} lang={lang} spaceId={space.id} /> : null}
            {current === "quiz" ? <QuizView lang={lang} /> : null}
            {current === "listening" ? <ListeningView lang={lang} /> : null}
            {current === "timer" ? <TimerView token={token} lang={lang} spaceId={space.id} user={user} onUserChange={onUserChange} /> : null}
            {current === "goals" ? <GoalsView token={token} lang={lang} /> : null}
            {current === "calendar" ? <CalendarView token={token} lang={lang} spaceId={space.id} /> : null}
          </div>
        </>
      )}
    </div>
  );
}

// ================================================================ First-login setup
// Shown once, right after a new user's first login. Step 1 asks for their
// native language and the language they want to learn — the native pick
// immediately becomes the dialog's (and then the whole app's) display
// language. Step 2 is the goal picker: they choose a first study goal from
// the admin-customisable suggestion list (or skip). Either way the account
// is marked onboarded server-side so the box never appears again.
function GoalPickerDialog({
  token,
  lang,
  userName,
  options,
  initialLearning,
  onDone,
}: {
  token: string;
  lang: Lang;
  userName: string;
  options: MeData["goalOptions"];
  initialLearning: string;
  onDone: () => void;
}) {
  const [step, setStep] = useState(1);
  const [nativeLang, setNativeLang] = useState<Lang>(lang);
  const [learnLang, setLearnLang] = useState(initialLearning || "en");
  const [selected, setSelected] = useState(0);
  const [error, setError] = useState("");
  const complete = useMutation({
    mutationFn: (args: { type: "minutes" | "words" | "sessions" | null; target: number | null }) =>
      api.completeOnboarding({ token, ...args, nativeLanguage: nativeLang, learningLanguage: learnLang }),
    onSuccess: onDone,
    onError: (e) => setError(e.message),
  });
  const pick = options[selected];
  // The dialog speaks the picked native language right away — that is the
  // language the whole system switches to on completion.
  const d = nativeLang;
  const welcomeParts = tx(d, "Chào mừng {name} đến với LaSpace! 🎉", "Welcome to LaSpace, {name}! 🎉").split("{name}");

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-3 sm:items-center" style={{ background: "rgba(5,8,25,0.72)" }} role="dialog" aria-modal="true" aria-label={step === 1 ? tx(d, "Ngôn ngữ của bạn", "Your languages") : tx(d, "Chọn mục tiêu học đầu tiên", "Pick your first study goal")}>
      <div className="card grid w-full max-w-md gap-3 p-4" style={{ boxShadow: "0 24px 60px rgba(3,5,18,0.6)" }}>
        <div className="grid justify-items-center gap-1.5 text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-full text-white" style={{ background: "linear-gradient(135deg,#2f6bff,#7c3aed 55%,#ff8a3d)" }}>
            <Icon name={step === 1 ? "book" : "target"} size={20} />
          </span>
          <p className="font-display text-base font-extrabold leading-snug">
            {welcomeParts[0]}
            <span style={{ color: "var(--accent)" }}>{userName}</span>
            {welcomeParts[1] ?? ""}
          </p>
          {step === 2 ? (
            <p style={{ color: "var(--dim)" }}>
              {tx(d, "Chọn mục tiêu học đầu tiên của bạn nhé — có mục tiêu rõ ràng sẽ giúp bạn học đều và vui hơn. Bạn luôn sửa hoặc thêm mục tiêu sau trong mục Mục tiêu học tập.", "Pick your first study goal — a clear target makes learning steadier and more fun. You can edit or add goals later under Learning goals.")}
            </p>
          ) : null}
        </div>

        {step === 1 ? (
          <>
            <div className="grid gap-2">
              <label className="block">
                <span className="font-semibold">{tx(d, "Ngôn ngữ mẹ đẻ của bạn là gì?", "What is your native language?")}</span>
                <select
                  className="input mt-1"
                  value={nativeLang}
                  onChange={(e) => setNativeLang(e.target.value as Lang)}
                  aria-label={tx(d, "Ngôn ngữ mẹ đẻ của bạn là gì?", "What is your native language?")}
                >
                  {LANGUAGES.map((l) => (
                    <option key={l.code} value={l.code}>{l.label}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="font-semibold">{tx(d, "Bạn muốn học ngôn ngữ nào?", "Which language do you want to learn?")}</span>
                <select
                  className="input mt-1"
                  value={learnLang}
                  onChange={(e) => setLearnLang(e.target.value)}
                  aria-label={tx(d, "Bạn muốn học ngôn ngữ nào?", "Which language do you want to learn?")}
                >
                  {LEARNING_LANGUAGES.map((l) => (
                    <option key={l.code} value={l.code}>{l.label}</option>
                  ))}
                </select>
              </label>
              <p style={{ color: "var(--dim)" }}>
                {tx(d, "Ngôn ngữ mẹ đẻ cũng sẽ trở thành ngôn ngữ hiển thị của app. Bạn luôn đổi lại sau trong Cài đặt.", "Your native language also becomes the app's display language. You can change both later in Settings.")}
              </p>
            </div>
            {error ? <p style={{ color: "var(--bad)" }}>{error}</p> : null}
            <button
              type="button"
              className="btn btn-orange btn-lg w-full"
              onClick={() => setStep(2)}
            >
              {tx(d, "Tiếp tục", "Continue")} <Icon name="chevR" size={14} />
            </button>
          </>
        ) : (
          <>
            <div className="grid gap-1.5" role="radiogroup" aria-label={tx(d, "Mục tiêu gợi ý", "Suggested goals")}>
              {options.map((o, i) => {
                const active = i === selected;
                return (
                  <button
                    key={`${o.type}-${o.target}-${i}`}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    className="btn justify-start"
                    style={{
                      minHeight: 36,
                      whiteSpace: "normal",
                      textAlign: "left",
                      ...(active ? { borderColor: "var(--accent)", background: "var(--surface2)", boxShadow: "0 0 0 1px var(--accent)" } : {}),
                    }}
                    onClick={() => setSelected(i)}
                  >
                    <span
                      className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full"
                      style={{ border: `2px solid ${active ? "var(--accent)" : "var(--dim)"}`, background: active ? "var(--accent)" : "transparent" }}
                    >
                      {active ? <Icon name="check" size={10} /> : null}
                    </span>
                    <span className="flex-1 font-bold">{d === "vi" ? o.labelVi : o.labelEn}</span>
                  </button>
                );
              })}
            </div>
            {error ? <p style={{ color: "var(--bad)" }}>{error}</p> : null}
            <button
              type="button"
              className="btn btn-orange btn-lg w-full"
              disabled={complete.isPending || !pick}
              onClick={() => { if (pick) complete.mutate({ type: pick.type, target: pick.target }); }}
            >
              <Icon name="target" size={14} /> {tx(d, "Bắt đầu với mục tiêu này", "Start with this goal")}
            </button>
            <button
              type="button"
              className="btn btn-ghost w-full"
              disabled={complete.isPending}
              onClick={() => complete.mutate({ type: null, target: null })}
            >
              {tx(d, "Để sau, tôi tự đặt mục tiêu", "Skip — I'll set my own goal later")}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ================================================================ App
export function App() {
  const queryClient = useQueryClient();
  const [token, setToken] = useState<string | null>(() => loadToken());
  const [view, setView] = useState<View>("home");
  // "admin" is the stats-only dashboard; "admin-<section>" is that
  // section's own page. All of them render the one AdminDashboard
  // component in the same tree slot, so it stays mounted (state and
  // loaded data kept) while the admin moves between pages.
  const isAdminView = view === "admin" || view.startsWith("admin-");
  const adminPage: AdminPage =
    view === "admin" ? "dashboard" : view.startsWith("admin-") ? (view.slice(6) as AdminSectionId) : "dashboard";
  const [activeSpaceId, setActiveSpaceId] = useState<number | null>(null);
  const [mobileNav, setMobileNav] = useState(false);
  const [viewAsUserId, setViewAsUserId] = useState<number | null>(null);

  const meQ = useQuery({
    queryKey: ["me", token],
    queryFn: () => api.me({ token: token ?? "" }),
    enabled: !!token,
    retry: false,
  });
  const spacesQ = useQuery({
    queryKey: ["spaces"],
    queryFn: () => api.listMySpaces({ token: token ?? "" }),
    enabled: !!token && !!meQ.data,
  });
  const pubQ = useQuery({ queryKey: ["public-info"], queryFn: () => api.getPublicInfo({}) });

  useEffect(() => {
    if (token && meQ.isError) {
      clearToken();
      setToken(null);
    }
  }, [token, meQ.isError]);

  // "System" theme tracking. These hooks MUST stay above the early returns
  // below: calling them after a conditional return changes the hook count
  // between the logged-out and logged-in renders and crashes React
  // ("Rendered more hooks than during the previous render") right after login.
  const [systemDark, setSystemDark] = useState<boolean>(() =>
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
      : true,
  );
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    setSystemDark(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // Global success alerts: every mutation that succeeds anywhere in the
  // app (any button, any screen) raises one professional toast, so the
  // user always gets the same clear confirmation. Errors keep their own
  // channels (inline form errors + the SDK failure notice, localised
  // below) so a failure is never reported twice.
  const langRef = useRef<Lang>("vi");
  langRef.current = meQ.data ? toLang(meQ.data.user.language) : "vi";
  useEffect(() => {
    setFailureNoticeText((_error, message) =>
      message === "Something went wrong. Please try again."
        ? tx(langRef.current, "Đã có lỗi xảy ra. Vui lòng thử lại nhé.", "Something went wrong. Please try again.")
        : message,
    );
    const unsubscribe = queryClient.getMutationCache().subscribe((event) => {
      if (event.type === "updated" && event.action?.type === "success") {
        pushToast(
          tx(langRef.current, "Thành công!", "Success!"),
          tx(langRef.current, "Thao tác của bạn đã được thực hiện.", "Your action was completed."),
        );
      }
    });
    return unsubscribe;
  }, [queryClient]);

  const onAuthed = (newToken: string, remember: boolean) => {
    storeToken(newToken, remember);
    setToken(newToken);
    setView("home");
  };

  const logout = useMutation({
    mutationFn: () => api.logout({ token: token ?? "" }),
    onSettled: () => {
      clearToken();
      setToken(null);
      setView("home");
      setViewAsUserId(null);
      queryClient.clear();
    },
  });

  if (!token || meQ.isError) {
    return (
      <div className="laspace-root theme-dark">
        <AuthScreen onAuthed={onAuthed} />
        <Toaster />
      </div>
    );
  }
  if (meQ.isPending || !meQ.data) {
    return (
      <div className="laspace-root theme-dark flex min-h-dvh items-center justify-center">
        <p style={{ color: "var(--dim)" }}>Đang tải LaSpace…</p>
        <Toaster />
      </div>
    );
  }

  const { user, maxSpaces, featureFlags, bankInfo, donateEnabled, goalOptions } = meQ.data;
  const lang: Lang = toLang(user.language);
  const theme = user.theme === "light" ? "light" : user.theme === "system" ? (systemDark ? "dark" : "light") : "dark";
  const spaces = spacesQ.data?.spaces ?? [];
  const activeSpace = spaces.find((s) => s.id === activeSpaceId) ?? null;

  const onUserChange = (u: PublicUser) => {
    queryClient.setQueryData(["me", token], { ...meQ.data, user: u });
  };
  const openSpace = (id: number) => {
    setActiveSpaceId(id);
    setView("space");
  };

  const sidebarProps = {
    token,
    lang,
    user,
    view,
    setView,
    spaces,
    maxSpaces,
    activeSpaceId,
    onOpenSpace: openSpace,
    onLogout: () => logout.mutate(),
    closeMobile: () => setMobileNav(false),
  };

  return (
    <div className={`laspace-root theme-${theme}`}>
      <div className="mx-auto flex min-h-dvh w-full max-w-6xl">
        <aside className="sticky top-0 hidden h-dvh w-56 shrink-0 overflow-y-auto px-3 py-5 md:block" style={{ background: "var(--surface)", borderRight: "1px solid var(--border)" }}>
          <SidebarContent {...sidebarProps} />
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex items-center gap-2 px-3 pb-4 pt-safe" style={{ background: "var(--bg)" }}>
            <button type="button" className="md:hidden" onClick={() => setMobileNav(true)} aria-label={tx(lang, "Mở menu", "Open menu")}>
              <img src={logoUrl} alt="Logo LaSpace" className="h-7 w-7 rounded-lg" />
            </button>
            <span className="font-display text-sm font-extrabold md:hidden" style={{ color: "var(--accent)" }}>LaSpace</span>
          </header>

          {mobileNav ? (
            <div className="fixed inset-0 z-40 md:hidden" style={{ background: "rgba(5,8,25,0.6)" }} onClick={() => setMobileNav(false)}>
              <div className="h-full w-60 p-3" style={{ background: "var(--surface)" }} onClick={(e) => e.stopPropagation()}>
                <SidebarContent {...sidebarProps} />
              </div>
            </div>
          ) : null}

          <main className="mx-auto w-full max-w-3xl flex-1 px-3 pb-10 pt-2">
            {viewAsUserId !== null && user.role === "admin" ? (
              <UserViewPreview token={token} lang={lang} userId={viewAsUserId} onExit={() => { setViewAsUserId(null); setView("admin"); }} />
            ) : view === "home" ? (
              <HomeView token={token} lang={lang} userName={user.name} spaces={spaces} maxSpaces={maxSpaces} bankInfo={bankInfo} donateEnabled={donateEnabled} onOpenSpace={openSpace} onGoStore={() => setView("store")} />
            ) : view === "store" ? (
              <StoreView token={token} lang={lang} spaces={spaces} flags={featureFlags} activeSpaceId={activeSpaceId} setActiveSpaceId={setActiveSpaceId} />
            ) : view === "settings" ? (
              <SettingsView
                token={token}
                lang={lang}
                user={user}
                onUserChange={onUserChange}
                onLangThemeChange={(patch) => {
                  onUserChange({
                    ...user,
                    language: patch.language ?? user.language,
                    theme: patch.theme ?? user.theme,
                  });
                }}
              />
            ) : isAdminView && user.role === "admin" ? (
              <AdminDashboard token={token} lang={lang} selfId={user.id} onViewUser={(id) => setViewAsUserId(id)} page={adminPage} />
            ) : view === "staff" && user.permissions.length > 0 ? (
              <StaffPanel token={token} lang={lang} selfId={user.id} />
            ) : view === "space" && activeSpace ? (
              <SpaceView token={token} lang={lang} user={user} space={activeSpace} flags={featureFlags} onUserChange={onUserChange} onGoStore={() => setView("store")} />
            ) : (
              <HomeView token={token} lang={lang} userName={user.name} spaces={spaces} maxSpaces={maxSpaces} bankInfo={bankInfo} donateEnabled={donateEnabled} onOpenSpace={openSpace} onGoStore={() => setView("store")} />
            )}
          </main>

          <footer className="grid gap-4 px-3 pb-8 pt-6 text-center">
            <ContactRow contacts={pubQ.data?.contacts ?? []} label={tx(lang, "Liên hệ với LaSpace", "Contact LaSpace")} />
            <BrandTagline />
          </footer>
        </div>
      </div>
      {user.onboarded ? null : (
        <GoalPickerDialog
          token={token}
          lang={lang}
          userName={user.name}
          options={goalOptions}
          initialLearning={user.learningLanguage}
          onDone={() => {
            queryClient.invalidateQueries({ queryKey: ["me"] });
            queryClient.invalidateQueries({ queryKey: ["goals"] });
          }}
        />
      )}
      <Toaster />
    </div>
  );
}
