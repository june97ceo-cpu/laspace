import { useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import { useMutation } from "@tanstack/react-query";
import { fileToBase64 } from "./api";
import { api } from "./api";
import {
Icon,
LANGUAGES,
LEARNING_LANGUAGES,
extractSheetId,
fmtDateTime,
t,
type Lang,
type PublicUser,
} from "./lib";
import { tx, txf } from "./i18n";

function Section({
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

export function SettingsView({
  token,
  lang,
  user,
  onUserChange,
  onLangThemeChange,
}: {
  token: string;
  lang: Lang;
  user: PublicUser;
  onUserChange: (u: PublicUser) => void;
  onLangThemeChange: (patch: { language?: Lang; theme?: "dark" | "light" | "system" }) => void;
}) {
  const L = lang === "vi";
  const [open, setOpen] = useState<string>("profile");

  // profile form — every field is required
  const [name, setName] = useState(user.name);
  const [phone, setPhone] = useState(user.phone);
  const [birthDate, setBirthDate] = useState(user.birthDate);
  const [gender, setGender] = useState(user.gender);
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileError, setProfileError] = useState("");

  // password form
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [newPw2, setNewPw2] = useState("");
  const [pwError, setPwError] = useState("");
  const [pwSaved, setPwSaved] = useState(false);

  // login info (display + save)
  const [loginSaved, setLoginSaved] = useState(false);

  // sheet
  const [sheetInput, setSheetInput] = useState(user.sheetId);
  const [sheetError, setSheetError] = useState("");
  const [syncMsg, setSyncMsg] = useState("");

  const updateProfile = useMutation({
    mutationFn: () =>
      api.updateProfile({
        token,
        name: name.trim(),
        phone: phone.trim(),
        birthDate,
        gender,
      }),
    onSuccess: (r) => { onUserChange(r.user); setProfileSaved(true); setProfileError(""); },
    onError: (e) => setProfileError(e.message),
  });
  // avatar (profile picture) — uploaded as an owned blob via updateAvatar
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [avatarError, setAvatarError] = useState("");
  const updateAvatar = useMutation({
    mutationFn: (args: { dataBase64: string; mimeType: string }) => api.updateAvatar({ token, ...args }),
    onSuccess: (r) => { onUserChange(r.user); setAvatarError(""); },
    onError: (e) => setAvatarError(e.message),
  });
  const onAvatarFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.type !== "image/jpeg" && file.type !== "image/png") {
      setAvatarError(tx(lang, "Ảnh đại diện cần là file JPG hoặc PNG nhé.", "Your profile picture must be a JPG or PNG file."));
      return;
    }
    if (file.size > 2_500_000) {
      setAvatarError(tx(lang, "Ảnh hơi lớn — hãy chọn ảnh dưới 2,5 MB nhé.", "That picture is a bit large — please pick one under 2.5 MB."));
      return;
    }
    setAvatarError("");
    const { dataBase64, mimeType } = await fileToBase64(file);
    updateAvatar.mutate({ dataBase64, mimeType });
  };

  const changePassword = useMutation({
    mutationFn: () => api.changePassword({ token, currentPassword: currentPw, newPassword: newPw }),
    onSuccess: () => { setPwSaved(true); setCurrentPw(""); setNewPw(""); setNewPw2(""); },
  });
  const savePrefs = useMutation({
    mutationFn: (patch: { language?: Lang; nativeLanguage?: Lang; learningLanguage?: string; theme?: "dark" | "light" | "system" }) => {
      onLangThemeChange({ language: patch.nativeLanguage ?? patch.language, theme: patch.theme });
      return api.updatePreferences({ token, language: patch.language, nativeLanguage: patch.nativeLanguage, learningLanguage: patch.learningLanguage, theme: patch.theme });
    },
    onSuccess: (r) => onUserChange(r.user),
  });
  const connectSheet = useMutation({
    mutationFn: (id: string) => api.connectSheet({ token, sheetIdOrLink: id }),
    onSuccess: (r) => { onUserChange(r.user); setSheetError(""); },
  });
  const disconnectSheet = useMutation({
    mutationFn: () => api.disconnectSheet({ token }),
    onSuccess: (r) => { onUserChange(r.user); setSheetInput(""); setSyncMsg(""); },
  });
  const syncNow = useMutation({
    mutationFn: () => api.syncSheetNow({ token }),
    onSuccess: (r) => {
      setSyncMsg(
        txf(lang, "Đã đồng bộ {0} buổi học và {1} từ vựng.", "Synced {0} sessions and {1} words.", r.sessions, r.words),
      );
    },
  });

  const submitProfile = (e: FormEvent) => {
    e.preventDefault();
    setProfileSaved(false);
    if (!name.trim() || !phone.trim() || !birthDate || !gender) {
      setProfileError(tx(lang, "Tất cả các trường đều bắt buộc — hãy điền đầy đủ nhé.", "All fields are required — please complete every field."));
      return;
    }
    setProfileError("");
    updateProfile.mutate();
  };
  const submitPassword = (e: FormEvent) => {
    e.preventDefault();
    setPwSaved(false);
    if (newPw.length < 6) {
      setPwError(tx(lang, "Mật khẩu mới cần ít nhất 6 ký tự.", "New password needs at least 6 characters."));
      return;
    }
    if (newPw !== newPw2) {
      setPwError(tx(lang, "Mật khẩu nhập lại chưa khớp.", "Passwords do not match."));
      return;
    }
    setPwError("");
    changePassword.mutate();
  };
  const submitSheet = (e: FormEvent) => {
    e.preventDefault();
    const id = extractSheetId(sheetInput);
    if (!id) {
      setSheetError(tx(lang, "ID trang tính chưa đúng định dạng.", "That sheet ID does not look right."));
      return;
    }
    setSheetError("");
    connectSheet.mutate(sheetInput);
  };

  const toggle = (id: string) => setOpen(open === id ? "" : id);
  const initials = user.name.trim().charAt(0).toUpperCase() || "L";

  return (
    <div className="mx-auto grid w-full max-w-xl gap-2.5">
      <h2 className="font-display text-base font-extrabold">{t(lang, "settings")}</h2>

      <Section title={tx(lang, "Thông tin của tôi", "My information")} open={open === "profile"} onToggle={() => toggle("profile")}>
        <div className="flex flex-col items-center gap-1 pb-1 text-center">
          {user.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt={tx(lang, "Ảnh đại diện của bạn", "Your profile picture")}
              className="h-16 w-16 rounded-full object-cover"
              style={{ border: "2px solid var(--border)" }}
            />
          ) : (
            <span
              className="flex h-16 w-16 items-center justify-center rounded-full font-display text-2xl font-extrabold text-white"
              style={{ background: "linear-gradient(135deg,#2f6bff,#7c3aed,#ff8a3d)" }}
              aria-hidden="true"
            >
              {initials}
            </span>
          )}
          <p className="font-display text-base font-extrabold">{user.name}</p>
          <p style={{ color: "var(--dim)" }}>{user.email}</p>
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/jpeg,image/png"
            className="hidden"
            onChange={onAvatarFile}
            aria-label={tx(lang, "Chọn ảnh đại diện mới", "Choose a new profile picture")}
          />
          <div className="flex flex-wrap items-center justify-center gap-1.5 pt-0.5">
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => avatarInputRef.current?.click()}
              disabled={updateAvatar.isPending}
              title={tx(lang, "Tải lên ảnh đại diện mới (JPG hoặc PNG)", "Upload a new profile picture (JPG or PNG)")}
            >
              <Icon name="edit" size={12} /> {tx(lang, "Đổi ảnh đại diện", "Change picture")}
            </button>
            {user.avatarUrl ? (
              <button
                type="button"
                className="btn btn-sm btn-danger"
                onClick={() => updateAvatar.mutate({ dataBase64: "", mimeType: "" })}
                disabled={updateAvatar.isPending}
                title={tx(lang, "Xóa ảnh đại diện, quay về chữ cái đầu", "Remove the profile picture and go back to your initial")}
              >
                <Icon name="trash" size={12} /> {tx(lang, "Xóa ảnh", "Remove")}
              </button>
            ) : null}
          </div>
          {avatarError ? <p style={{ color: "var(--bad)" }}>{avatarError}</p> : null}
        </div>
        <form onSubmit={submitProfile} className="grid gap-2">
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span style={{ color: "var(--dim)" }}>{tx(lang, "Họ và tên", "Full name")} *</span>
              <input maxLength={80} className="input" value={name} onChange={(e) => setName(e.target.value)} required />
            </label>
            <label className="block">
              <span style={{ color: "var(--dim)" }}>{tx(lang, "Số điện thoại", "Phone")} *</span>
              <input maxLength={20} className="input" value={phone} onChange={(e) => setPhone(e.target.value)} required />
            </label>
            <label className="block">
              <span style={{ color: "var(--dim)" }}>{tx(lang, "Ngày tháng năm sinh", "Date of birth")} *</span>
              <input  type="date" className="input" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} required aria-label={tx(lang, "Ngày tháng năm sinh", "Date of birth")} />
            </label>
            <label className="block">
              <span style={{ color: "var(--dim)" }}>{tx(lang, "Giới tính", "Gender")} *</span>
              <select className="input" value={gender} onChange={(e) => setGender(e.target.value)} aria-label={tx(lang, "Giới tính", "Gender")} required>
                <option value="">{tx(lang, "Chọn giới tính", "Select gender")}</option>
                <option value="Nam">{tx(lang, "Nam", "Male")}</option>
                <option value="Nữ">{tx(lang, "Nữ", "Female")}</option>
                <option value="Khác">{tx(lang, "Khác", "Other")}</option>
              </select>
            </label>
          </div>
          {profileError ? <p style={{ color: "var(--bad)" }}>{profileError}</p> : null}
          <div className="flex items-center gap-2">
            <button type="submit" className="btn btn-orange" disabled={updateProfile.isPending}>{t(lang, "save")}</button>
            {profileSaved ? <span style={{ color: "var(--good)" }}>{tx(lang, "Đã lưu.", "Saved.")}</span> : null}
          </div>
        </form>

        <div className="grid gap-1.5 border-t pt-2" style={{ borderColor: "var(--border)" }}>
          <p className="font-semibold">{tx(lang, "Thông tin đăng nhập", "Login information")}</p>
          <p style={{ color: "var(--dim)" }}>Email: {user.email}</p>
          {user.role === "admin" ? (
            <p style={{ color: "var(--dim)" }}>{tx(lang, "Vai trò", "Role")}: Admin</p>
          ) : null}
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="btn"
              onClick={() => setLoginSaved(true)}
            >
              <Icon name="check" size={13} /> {tx(lang, "Lưu thông tin đăng nhập", "Save login information")}
            </button>
            {loginSaved ? <span style={{ color: "var(--good)" }}>{tx(lang, "Đã lưu.", "Saved.")}</span> : null}
          </div>
        </div>
      </Section>

      <Section title={tx(lang, "Đổi mật khẩu", "Change password")} open={open === "password"} onToggle={() => toggle("password")}>
        <form onSubmit={submitPassword} className="grid gap-2">
          <label className="block">
            <span style={{ color: "var(--dim)" }}>{tx(lang, "Mật khẩu hiện tại", "Current password")}</span>
            <input maxLength={100} type="password" className="input" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} autoComplete="current-password" />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span style={{ color: "var(--dim)" }}>{tx(lang, "Mật khẩu mới", "New password")}</span>
              <input maxLength={100} minLength={6} type="password" className="input" value={newPw} onChange={(e) => setNewPw(e.target.value)} autoComplete="new-password" />
            </label>
            <label className="block">
              <span style={{ color: "var(--dim)" }}>{tx(lang, "Nhập lại mật khẩu mới", "Repeat new password")}</span>
              <input type="password" className="input" value={newPw2} onChange={(e) => setNewPw2(e.target.value)} autoComplete="new-password" />
            </label>
          </div>
          {pwError ? <p style={{ color: "var(--bad)" }}>{pwError}</p> : null}
          {pwSaved ? <p style={{ color: "var(--good)" }}>{tx(lang, "Đã cập nhật mật khẩu.", "Password updated.")}</p> : null}
          <div>
            <button type="submit" className="btn btn-orange" disabled={changePassword.isPending} title={tx(lang, "Đổi mật khẩu đăng nhập của bạn", "Change your sign-in password")}>
              {tx(lang, "Cập nhật mật khẩu", "Update password")}
            </button>
          </div>
        </form>
      </Section>

      <Section
        title={tx(lang, "Kết nối Google Sheet của bạn", "Connect your Google Sheet")}
        badge={user.sheetConnected ? (tx(lang, "Đã kết nối", "Connected")) : (tx(lang, "Chưa kết nối", "Not connected"))}
        open={open === "sheet"}
        onToggle={() => toggle("sheet")}
      >
        {!user.sheetConnected ? (
          <>
            <p style={{ color: "var(--dim)" }}>{tx(lang, "Kết nối 1 lần — dữ liệu học của bạn sẽ đồng bộ về trang tính của chính bạn.", "Connect once — your learning data syncs to your own sheet.")}</p>
            <form onSubmit={submitSheet} className="grid gap-2">
              <label className="block">
                <span style={{ color: "var(--dim)" }}>{tx(lang, "ID trang tính (hoặc dán cả link trang tính)", "Spreadsheet ID (or paste the full link)")}</span>
                <input maxLength={500} className="input" value={sheetInput} onChange={(e) => setSheetInput(e.target.value)} placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs…" />
              </label>
              {sheetError ? <p style={{ color: "var(--bad)" }}>{sheetError}</p> : null}
              <div>
                <button type="submit" className="btn btn-orange" disabled={connectSheet.isPending}>
                  <Icon name="link" size={13} /> {tx(lang, "Kết nối với Google", "Connect with Google")}
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="grid gap-2">
            <p className="flex items-center gap-1.5" style={{ color: "var(--good)" }}>
              <Icon name="check" size={13} /> {tx(lang, "Đã kết nối trang tính của bạn", "Your sheet is connected")}
            </p>
            <p style={{ color: "var(--dim)" }}>ID: {user.sheetId}</p>
            {user.sheetLastSyncAt ? (
              <p style={{ color: "var(--dim)" }}>{tx(lang, "Đồng bộ gần nhất:", "Last sync:")} {fmtDateTime(user.sheetLastSyncAt, lang)}</p>
            ) : null}
            {syncMsg ? <p style={{ color: "var(--good)" }}>{syncMsg}</p> : null}
            <div className="flex flex-wrap gap-1.5">
              <a className="btn" href={`https://docs.google.com/spreadsheets/d/${user.sheetId}`} target="_blank" rel="noreferrer">
                {tx(lang, "Mở trang tính của tôi", "Open my sheet")}
              </a>
              <button type="button" className="btn btn-primary" onClick={() => syncNow.mutate()} disabled={syncNow.isPending}>
                {tx(lang, "Đồng bộ ngay", "Sync now")}
              </button>
              <button type="button" className="btn btn-danger" onClick={() => disconnectSheet.mutate()} disabled={disconnectSheet.isPending}>
                {tx(lang, "Ngắt kết nối", "Disconnect")}
              </button>
            </div>
          </div>
        )}
      </Section>

      <Section title={tx(lang, "Ngôn ngữ và giao diện", "Language & appearance")} open={open === "prefs"} onToggle={() => toggle("prefs")}>
        <div className="grid gap-2">
          <div>
            <p className="pb-1" style={{ color: "var(--dim)" }}>{tx(lang, "Ngôn ngữ mẹ đẻ", "Native language")}</p>
            <select
              className="input"
              style={{ maxWidth: 220 }}
              value={user.nativeLanguage || lang}
              onChange={(e) => savePrefs.mutate({ nativeLanguage: e.target.value as Lang })}
              aria-label={tx(lang, "Ngôn ngữ mẹ đẻ", "Native language")}
            >
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>{l.label}</option>
              ))}
            </select>
            <p className="pt-1" style={{ color: "var(--dim)" }}>{tx(lang, "Ngôn ngữ mẹ đẻ cũng sẽ trở thành ngôn ngữ hiển thị của app. Bạn luôn đổi lại sau trong Cài đặt.", "Your native language also becomes the app's display language. You can change both later in Settings.")}</p>
          </div>
          <div>
            <p className="pb-1" style={{ color: "var(--dim)" }}>{tx(lang, "Ngôn ngữ bạn đang học", "Language you are learning")}</p>
            <select
              className="input"
              style={{ maxWidth: 220 }}
              value={user.learningLanguage || "en"}
              onChange={(e) => savePrefs.mutate({ learningLanguage: e.target.value })}
              aria-label={tx(lang, "Ngôn ngữ bạn đang học", "Language you are learning")}
            >
              {LEARNING_LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>{l.label}</option>
              ))}
            </select>
          </div>
          <div>
            <p className="pb-1" style={{ color: "var(--dim)" }}>{tx(lang, "Giao diện", "Theme")}</p>
            <div className="flex flex-wrap gap-1.5">
              <button type="button" className={`tabbtn ${user.theme === "light" ? "active" : ""}`} onClick={() => savePrefs.mutate({ theme: "light" })}>{tx(lang, "Sáng", "Light")}</button>
              <button type="button" className={`tabbtn ${user.theme === "dark" ? "active" : ""}`} onClick={() => savePrefs.mutate({ theme: "dark" })}>{tx(lang, "Tối", "Dark")}</button>
              <button type="button" className={`tabbtn ${user.theme === "system" ? "active" : ""}`} onClick={() => savePrefs.mutate({ theme: "system" })}>{tx(lang, "Theo hệ thống", "System")}</button>
            </div>
          </div>
        </div>
      </Section>
    </div>
  );
}
