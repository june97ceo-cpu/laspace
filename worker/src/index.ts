// LaSpace — Cloudflare Worker API.
//
// One Worker serves:
//   POST /api/:action   — the app API (same action names + payloads as the
//                         Muse server build, so the React client only swaps
//                         its transport: see frontend/src/api.ts)
//   GET  /avatars/:id   — profile pictures stored as base64 in D1
//                         (users.avatar_data); no R2 bucket is used
//   everything else     — the static frontend (Workers Static Assets, SPA)
//
// Storage: D1 (binding DB) only — accounts, learning data and avatar
// images all live there, so the app runs on the free Pages + Workers + D1
// tier with no R2. Passwords are verified against salted PBKDF2
// hashes (120k iterations, SHA-256) — identical parameters to the Muse
// build, so existing password hashes stay valid if data is migrated.

export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  APP_ORIGIN?: string;
}

// ------------------------------------------------------------------ utils
function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}
function fail(message: string, status = 400): Response {
  return json({ error: message }, status);
}

function randomHex(bytes: number): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}
function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(Math.floor(hex.length / 2));
  for (let i = 0; i < out.length; i++) out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}
function base64ToBytes(b64: string): Uint8Array | null {
  try {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}
async function hashPassword(password: string, saltHex: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: hexToBytes(saltHex) as BufferSource, iterations: 120_000, hash: "SHA-256" },
    key,
    256,
  );
  return Array.from(new Uint8Array(bits), (b) => b.toString(16).padStart(2, "0")).join("");
}
async function verifyPassword(password: string, salt: string, expected: string): Promise<boolean> {
  const actual = await hashPassword(password, salt);
  if (actual.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < actual.length; i++) diff |= actual.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}
const iso = (ms: number | null | undefined): string | null =>
  ms == null ? null : new Date(ms).toISOString();

// ------------------------------------------------------------------ types
interface UserRow {
  id: number;
  name: string;
  email: string;
  password_hash: string;
  password_salt: string;
  role: string;
  permissions: string;
  last_login_at: number | null;
  onboarded: number;
  guest: number;
  locked: number;
  phone: string;
  birth_year: number | null;
  birth_date: string;
  max_spaces: number | null;
  gender: string;
  language: string;
  native_language: string;
  learning_language: string;
  avatar_data: string;
  theme: string;
  sheet_id: string;
  sheet_connected: number;
  sheet_last_sync_at: number | null;
  pomo_focus: number;
  pomo_break: number;
  pomo_notify: number;
  created_at: number;
}

const FEATURE_KEYS = ["flashcards", "vocab", "notes", "quiz", "listening", "timer", "goals", "calendar"] as const;

function parsePermissions(raw: string): string[] {
  try {
    const p = JSON.parse(raw) as unknown;
    return Array.isArray(p) ? p.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function publicUser(env: Env, origin: string, u: UserRow) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    permissions: parsePermissions(u.permissions),
    lastLoginAt: iso(u.last_login_at),
    onboarded: u.onboarded === 1,
    guest: u.guest === 1,
    phone: u.phone,
    birthYear: u.birth_year,
    birthDate: u.birth_date ?? "",
    maxSpaces: u.max_spaces,
    gender: u.gender,
    language: u.language,
    nativeLanguage: u.native_language ?? "",
    learningLanguage: u.learning_language ?? "",
    avatarUrl: u.avatar_data ? `${env.APP_ORIGIN || origin}/avatars/${u.id}` : "",
    theme: u.theme,
    sheetId: u.sheet_id,
    sheetConnected: u.sheet_connected === 1,
    sheetLastSyncAt: iso(u.sheet_last_sync_at),
    pomoFocus: u.pomo_focus,
    pomoBreak: u.pomo_break,
    pomoNotify: u.pomo_notify === 1,
    createdAt: iso(u.created_at),
  };
}

// ------------------------------------------------------------------ db helpers
async function getSetting(db: D1Database, key: string, fallback: string): Promise<string> {
  const row = await db.prepare("SELECT value FROM app_settings WHERE key = ?").bind(key).first<{ value: string }>();
  return row?.value ?? fallback;
}
async function setSetting(db: D1Database, key: string, value: string): Promise<void> {
  await db.prepare("INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").bind(key, value).run();
}
async function getMaxSpaces(db: D1Database): Promise<number> {
  const n = Number.parseInt(await getSetting(db, "max_spaces", "3"), 10);
  return Number.isFinite(n) && n > 0 ? n : 3;
}
async function effectiveMaxSpaces(db: D1Database, u: UserRow): Promise<number> {
  return u.max_spaces != null && u.max_spaces > 0 ? u.max_spaces : getMaxSpaces(db);
}
async function featureFlags(db: D1Database): Promise<Record<string, boolean>> {
  let parsed: Record<string, unknown> = {};
  try { parsed = JSON.parse(await getSetting(db, "feature_flags", "{}")) as Record<string, unknown>; } catch { parsed = {}; }
  const flags: Record<string, boolean> = {};
  for (const k of FEATURE_KEYS) flags[k] = parsed[k] !== false;
  return flags;
}
async function getBankInfo(db: D1Database) {
  const raw = await getSetting(db, "bank_info", "");
  if (raw) {
    try {
      const p = JSON.parse(raw) as Record<string, unknown>;
      return {
        bank: typeof p.bank === "string" ? p.bank : "",
        bankBin: typeof p.bankBin === "string" ? p.bankBin : "",
        account: typeof p.account === "string" ? p.account : "",
        holder: typeof p.holder === "string" ? p.holder : "",
      };
    } catch { /* fall through */ }
  }
  return { bank: "", bankBin: "", account: "", holder: "" };
}
async function donateEnabled(db: D1Database): Promise<boolean> {
  return (await getSetting(db, "donate_enabled", "1")) !== "0";
}
async function contactLinks(db: D1Database) {
  try {
    const p = JSON.parse(await getSetting(db, "contact_links", "[]")) as unknown;
    if (!Array.isArray(p)) return [];
    return p.filter((c): c is { id: string; platform: string; url: string } =>
      typeof c === "object" && c !== null &&
      typeof (c as { id: unknown }).id === "string" &&
      typeof (c as { platform: unknown }).platform === "string" &&
      typeof (c as { url: unknown }).url === "string");
  } catch { return []; }
}
const DEFAULT_GOAL_OPTIONS = [
  { type: "minutes", target: 150, labelVi: "Học 150 phút", labelEn: "Study 150 minutes" },
  { type: "words", target: 30, labelVi: "Học 30 từ vựng mới", labelEn: "Learn 30 new words" },
  { type: "sessions", target: 10, labelVi: "Hoàn thành 10 buổi học", labelEn: "Finish 10 study sessions" },
  { type: "minutes", target: 600, labelVi: "Thử thách: học 600 phút", labelEn: "Challenge: study 600 minutes" },
];
async function goalOptions(db: D1Database) {
  const raw = await getSetting(db, "goal_options", "");
  if (raw) {
    try {
      const p = JSON.parse(raw) as unknown;
      if (Array.isArray(p) && p.length > 0) return p;
    } catch { /* defaults */ }
  }
  return DEFAULT_GOAL_OPTIONS;
}

class ApiError extends Error {}
function need(cond: unknown, message: string): asserts cond {
  if (!cond) throw new ApiError(message);
}

async function requireUser(env: Env, token: string): Promise<UserRow> {
  need(typeof token === "string" && token.length > 0, "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
  const s = await env.DB.prepare("SELECT user_id, expires_at FROM auth_sessions WHERE token = ?").bind(token).first<{ user_id: number; expires_at: number }>();
  need(s && s.expires_at > Date.now(), "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
  const u = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(s.user_id).first<UserRow>();
  need(u, "Tài khoản không còn tồn tại.");
  need(u.locked !== 1, "Tài khoản đã bị khóa. Vui lòng liên hệ quản trị viên.");
  return u;
}
async function requireAdmin(env: Env, token: string): Promise<UserRow> {
  const u = await requireUser(env, token);
  need(u.role === "admin", "Khu vực này chỉ dành cho quản trị viên.");
  return u;
}
async function ownSpace(env: Env, userId: number, spaceId: number) {
  const s = await env.DB.prepare("SELECT * FROM spaces WHERE id = ? AND user_id = ?").bind(spaceId, userId).first();
  need(s, "Không tìm thấy không gian này.");
  return s as { id: number; user_id: number; name: string; created_at: number };
}
async function createSession(env: Env, userId: number, remember: boolean): Promise<string> {
  const token = randomHex(32);
  const days = remember ? 30 : 1;
  await env.DB.prepare("INSERT INTO auth_sessions (token, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)")
    .bind(token, userId, Date.now() + days * 86_400_000, Date.now()).run();
  return token;
}

// ------------------------------------------------------------------ actions
type Args = Record<string, unknown>;
const str = (a: Args, k: string, fallback = ""): string => (typeof a[k] === "string" ? (a[k] as string) : fallback);
const num = (a: Args, k: string, fallback = 0): number => (typeof a[k] === "number" ? (a[k] as number) : fallback);
const bool = (a: Args, k: string): boolean => a[k] === true;

async function handleAction(env: Env, origin: string, action: string, a: Args): Promise<Response> {
  const db = env.DB;
  const token = str(a, "token");
  switch (action) {
    // ------------------------------------------------ auth
    case "getPublicInfo": {
      const total = await db.prepare("SELECT COUNT(*) AS c FROM users").first<{ c: number }>();
      const readNum = async (key: string): Promise<number | null> => {
        const raw = await getSetting(db, key, "");
        if (!raw) return null;
        const n = Number.parseInt(raw, 10);
        return Number.isFinite(n) && n >= 0 ? n : null;
      };
      return json({
        showcase: {
          users: (await readNum("showcase_users")) ?? total?.c ?? 0,
          fiveStar: (await readNum("showcase_five_star")) ?? 0,
          downloads: await readNum("showcase_downloads"),
        },
        contacts: await contactLinks(db),
        bankInfo: await getBankInfo(db),
      });
    }
    case "register": {
      need(bool(a, "consent"), "Bạn cần đồng ý cung cấp thông tin cá nhân để tiếp tục đăng ký.");
      const email = str(a, "email").trim().toLowerCase();
      need(str(a, "name").trim().length >= 1, "Hãy nhập họ và tên của bạn nhé.");
      need(str(a, "password").length >= 6, "Mật khẩu cần ít nhất 6 ký tự.");
      const existing = await db.prepare("SELECT id FROM users WHERE email = ?").bind(email).first();
      need(!existing, "Email này đã được đăng ký. Hãy đăng nhập nhé.");
      const salt = randomHex(16);
      await db.prepare(
        "INSERT INTO users (name, email, password_hash, password_salt, role, created_at) VALUES (?, ?, ?, ?, 'user', ?)",
      ).bind(str(a, "name").trim(), email, await hashPassword(str(a, "password"), salt), salt, Date.now()).run();
      // No session: the user signs in themselves after registering.
      return json({ ok: true });
    }
    case "login": {
      const email = str(a, "email").trim().toLowerCase();
      const u = await db.prepare("SELECT * FROM users WHERE email = ?").bind(email).first<UserRow>();
      need(u && (await verifyPassword(str(a, "password"), u.password_salt, u.password_hash)), "Email hoặc mật khẩu chưa đúng. Kiểm tra lại nhé.");
      need(u.locked !== 1, "Tài khoản đã bị khóa. Vui lòng liên hệ quản trị viên.");
      const now = Date.now();
      await db.prepare("UPDATE users SET last_login_at = ? WHERE id = ?").bind(now, u.id).run();
      const t = await createSession(env, u.id, bool(a, "remember"));
      return json({ token: t, user: publicUser(env, origin, { ...u, last_login_at: now }) });
    }
    case "logout": {
      await db.prepare("DELETE FROM auth_sessions WHERE token = ?").bind(token).run();
      return json({ ok: true });
    }
    case "requestPasswordReset": {
      const email = str(a, "email").trim().toLowerCase();
      const u = await db.prepare("SELECT id FROM users WHERE email = ?").bind(email).first<{ id: number }>();
      if (u) {
        const open = await db.prepare("SELECT id FROM password_reset_requests WHERE user_id = ? AND status = 'pending' LIMIT 1").bind(u.id).first();
        if (!open) {
          await db.prepare("INSERT INTO password_reset_requests (user_id, email, status, created_at) VALUES (?, ?, 'pending', ?)").bind(u.id, email, Date.now()).run();
        }
      }
      return json({ ok: true });
    }
    case "me": {
      const me = await requireUser(env, token);
      return json({
        user: publicUser(env, origin, me),
        maxSpaces: await effectiveMaxSpaces(db, me),
        featureFlags: await featureFlags(db),
        bankInfo: await getBankInfo(db),
        donateEnabled: await donateEnabled(db),
        goalOptions: await goalOptions(db),
      });
    }
    case "seedAdminAccount": {
      const admins = await db.prepare("SELECT id FROM users WHERE role = 'admin' LIMIT 1").first();
      if (admins) return json({ created: false });
      const email = str(a, "email").trim().toLowerCase();
      const existing = await db.prepare("SELECT id FROM users WHERE email = ?").bind(email).first<{ id: number }>();
      if (existing) {
        await db.prepare("UPDATE users SET role = 'admin' WHERE id = ?").bind(existing.id).run();
        return json({ created: true });
      }
      const salt = randomHex(16);
      await db.prepare("INSERT INTO users (name, email, password_hash, password_salt, role, created_at) VALUES (?, ?, ?, ?, 'admin', ?)")
        .bind(str(a, "name").trim(), email, await hashPassword(str(a, "password"), salt), salt, Date.now()).run();
      return json({ created: true });
    }

    // ------------------------------------------------ profile
    case "updateProfile": {
      const me = await requireUser(env, token);
      const birthDate = str(a, "birthDate");
      need(/^\d{4}-\d{2}-\d{2}$/.test(birthDate), "Hãy chọn ngày tháng năm sinh.");
      const dob = new Date(`${birthDate}T00:00:00`);
      need(!Number.isNaN(dob.getTime()) && dob.getTime() <= Date.now(), "Ngày tháng năm sinh chưa hợp lệ.");
      await db.prepare("UPDATE users SET name = ?, phone = ?, birth_date = ?, birth_year = ?, gender = ? WHERE id = ?")
        .bind(str(a, "name").trim(), str(a, "phone").trim(), birthDate, dob.getFullYear(), str(a, "gender").trim(), me.id).run();
      const u = await db.prepare("SELECT * FROM users WHERE id = ?").bind(me.id).first<UserRow>();
      return json({ user: publicUser(env, origin, u!) });
    }
    case "updateAvatar": {
      const me = await requireUser(env, token);
      const data = str(a, "dataBase64");
      if (data === "") {
        // Remove: clear the stored picture; the UI falls back to the
        // initial-letter avatar.
        await db.prepare("UPDATE users SET avatar_data = '' WHERE id = ?").bind(me.id).run();
      } else {
        const mime = str(a, "mimeType");
        need(mime === "image/jpeg" || mime === "image/png", "Ảnh đại diện cần là file JPG hoặc PNG nhé.");
        const bytes = base64ToBytes(data);
        need(bytes && bytes.length > 0 && bytes.length <= 2_500_000, "Ảnh chưa hợp lệ hoặc quá lớn (tối đa khoảng 2,5 MB).");
        // No R2: keep the picture in D1 as a data URI, served back by
        // GET /avatars/<userId>.
        await db.prepare("UPDATE users SET avatar_data = ? WHERE id = ?")
          .bind(`data:${mime};base64,${data}`, me.id).run();
      }
      const u = await db.prepare("SELECT * FROM users WHERE id = ?").bind(me.id).first<UserRow>();
      return json({ user: publicUser(env, origin, u!) });
    }
    case "changePassword": {
      const me = await requireUser(env, token);
      need(await verifyPassword(str(a, "currentPassword"), me.password_salt, me.password_hash), "Mật khẩu hiện tại chưa đúng.");
      need(str(a, "newPassword").length >= 6, "Mật khẩu mới cần ít nhất 6 ký tự.");
      const salt = randomHex(16);
      await db.prepare("UPDATE users SET password_hash = ?, password_salt = ? WHERE id = ?")
        .bind(await hashPassword(str(a, "newPassword"), salt), salt, me.id).run();
      return json({ ok: true });
    }
    case "updatePreferences": {
      const me = await requireUser(env, token);
      const sets: string[] = [];
      const vals: unknown[] = [];
      const put = (col: string, v: unknown) => { if (v !== undefined) { sets.push(`${col} = ?`); vals.push(v); } };
      put("language", a.language);
      if (a.nativeLanguage !== undefined) { put("native_language", a.nativeLanguage); put("language", a.nativeLanguage); }
      put("learning_language", a.learningLanguage);
      put("theme", a.theme);
      put("pomo_focus", a.pomoFocus);
      put("pomo_break", a.pomoBreak);
      if (a.pomoNotify !== undefined) put("pomo_notify", a.pomoNotify === true ? 1 : 0);
      if (sets.length) {
        await db.prepare(`UPDATE users SET ${sets.join(", ")} WHERE id = ?`).bind(...vals, me.id).run();
      }
      const u = await db.prepare("SELECT * FROM users WHERE id = ?").bind(me.id).first<UserRow>();
      return json({ user: publicUser(env, origin, u!) });
    }
    case "completeOnboarding": {
      const me = await requireUser(env, token);
      if (typeof a.nativeLanguage === "string" && a.nativeLanguage) {
        await db.prepare("UPDATE users SET native_language = ?, language = ? WHERE id = ?").bind(a.nativeLanguage, a.nativeLanguage, me.id).run();
      }
      if (typeof a.learningLanguage === "string") {
        await db.prepare("UPDATE users SET learning_language = ? WHERE id = ?").bind(a.learningLanguage, me.id).run();
      }
      const goal = a.goal as { type?: string; target?: number } | undefined;
      if (goal && typeof goal.target === "number" && goal.target > 0 && ["minutes", "words", "sessions"].includes(goal.type ?? "")) {
        await db.prepare("INSERT INTO goals (user_id, type, target, deadline, created_at) VALUES (?, ?, ?, NULL, ?)")
          .bind(me.id, goal.type, goal.target, Date.now()).run();
      }
      await db.prepare("UPDATE users SET onboarded = 1 WHERE id = ?").bind(me.id).run();
      return json({ ok: true });
    }
    case "connectSheet": {
      const me = await requireUser(env, token);
      let id = str(a, "sheetIdOrLink").trim();
      const m = id.match(/\/d\/([a-zA-Z0-9_-]+)/);
      if (m?.[1]) id = m[1];
      need(/^[a-zA-Z0-9_-]{10,}$/.test(id), "ID trang tính chưa đúng định dạng. Kiểm tra lại nhé.");
      await db.prepare("UPDATE users SET sheet_id = ?, sheet_connected = 1 WHERE id = ?").bind(id, me.id).run();
      const u = await db.prepare("SELECT * FROM users WHERE id = ?").bind(me.id).first<UserRow>();
      return json({ user: publicUser(env, origin, u!) });
    }
    case "disconnectSheet": {
      const me = await requireUser(env, token);
      await db.prepare("UPDATE users SET sheet_id = '', sheet_connected = 0, sheet_last_sync_at = NULL WHERE id = ?").bind(me.id).run();
      const u = await db.prepare("SELECT * FROM users WHERE id = ?").bind(me.id).first<UserRow>();
      return json({ user: publicUser(env, origin, u!) });
    }
    case "syncSheetNow": {
      const me = await requireUser(env, token);
      need(me.sheet_connected === 1 && !!me.sheet_id, "Hãy kết nối trang tính trước khi đồng bộ.");
      const s = await db.prepare("SELECT COUNT(*) AS c FROM study_sessions WHERE user_id = ?").bind(me.id).first<{ c: number }>();
      const w = await db.prepare("SELECT COUNT(*) AS c FROM words WHERE space_id IN (SELECT id FROM spaces WHERE user_id = ?)").bind(me.id).first<{ c: number }>();
      const now = Date.now();
      await db.prepare("UPDATE users SET sheet_last_sync_at = ? WHERE id = ?").bind(now, me.id).run();
      return json({ sessions: s?.c ?? 0, words: w?.c ?? 0, syncedAt: iso(now) });
    }

    // ------------------------------------------------ spaces
    case "listMySpaces": {
      const me = await requireUser(env, token);
      const { results } = await db.prepare("SELECT * FROM spaces WHERE user_id = ? ORDER BY id ASC").bind(me.id).all<{ id: number; name: string; created_at: number }>();
      const spaces = [];
      for (const s of results) {
        const feats = await db.prepare("SELECT feature_key FROM space_features WHERE space_id = ?").bind(s.id).all<{ feature_key: string }>();
        const wc = await db.prepare("SELECT COUNT(*) AS c FROM words WHERE space_id = ?").bind(s.id).first<{ c: number }>();
        spaces.push({ id: s.id, name: s.name, createdAt: iso(s.created_at), wordCount: wc?.c ?? 0, features: feats.results.map((f) => f.feature_key) });
      }
      return json({ spaces });
    }
    case "createSpace": {
      const me = await requireUser(env, token);
      const count = await db.prepare("SELECT COUNT(*) AS c FROM spaces WHERE user_id = ?").bind(me.id).first<{ c: number }>();
      const max = await effectiveMaxSpaces(db, me);
      need((count?.c ?? 0) < max, `Bạn đã có tối đa ${max} không gian. Hãy liên hệ quản trị viên nếu cần thêm.`);
      const r = await db.prepare("INSERT INTO spaces (user_id, name, created_at) VALUES (?, ?, ?) RETURNING id")
        .bind(me.id, str(a, "name").trim(), Date.now()).first<{ id: number }>();
      need(r, "Không tạo được không gian. Thử lại sau nhé.");
      return json({ id: r.id });
    }
    case "renameSpace": {
      const me = await requireUser(env, token);
      await ownSpace(env, me.id, num(a, "spaceId"));
      await db.prepare("UPDATE spaces SET name = ? WHERE id = ?").bind(str(a, "name").trim(), num(a, "spaceId")).run();
      return json({ ok: true });
    }
    case "deleteSpace": {
      const me = await requireUser(env, token);
      const id = num(a, "spaceId");
      await ownSpace(env, me.id, id);
      await db.batch([
        db.prepare("DELETE FROM words WHERE space_id = ?").bind(id),
        db.prepare("DELETE FROM notes WHERE space_id = ?").bind(id),
        db.prepare("DELETE FROM study_sessions WHERE space_id = ?").bind(id),
        db.prepare("DELETE FROM space_features WHERE space_id = ?").bind(id),
        db.prepare("DELETE FROM calendar_events WHERE space_id = ?").bind(id),
        db.prepare("DELETE FROM spaces WHERE id = ?").bind(id),
      ]);
      return json({ ok: true });
    }
    case "addFeatureToSpace": {
      const me = await requireUser(env, token);
      const spaceId = num(a, "spaceId");
      const key = str(a, "featureKey");
      await ownSpace(env, me.id, spaceId);
      const flags = await featureFlags(db);
      need(flags[key] !== false, "Tính năng này đang tạm tắt. Thử lại sau nhé.");
      const ex = await db.prepare("SELECT id FROM space_features WHERE space_id = ? AND feature_key = ?").bind(spaceId, key).first();
      if (!ex) await db.prepare("INSERT INTO space_features (space_id, feature_key, created_at) VALUES (?, ?, ?)").bind(spaceId, key, Date.now()).run();
      return json({ ok: true });
    }
    case "removeFeatureFromSpace": {
      const me = await requireUser(env, token);
      await ownSpace(env, me.id, num(a, "spaceId"));
      await db.prepare("DELETE FROM space_features WHERE space_id = ? AND feature_key = ?").bind(num(a, "spaceId"), str(a, "featureKey")).run();
      return json({ ok: true });
    }

    // ------------------------------------------------ words / flashcards
    case "listWords": {
      const me = await requireUser(env, token);
      await ownSpace(env, me.id, num(a, "spaceId"));
      const { results } = await db.prepare("SELECT * FROM words WHERE space_id = ? ORDER BY id DESC").bind(num(a, "spaceId"))
        .all<{ id: number; space_id: number; word: string; meaning: string; ipa_uk: string; ipa_us: string; example: string; in_flashcards: number; next_review_at: number | null; created_at: number }>();
      return json({
        words: results.map((w) => ({
          id: w.id, spaceId: w.space_id, word: w.word, meaning: w.meaning, ipaUk: w.ipa_uk, ipaUs: w.ipa_us,
          example: w.example, inFlashcards: w.in_flashcards === 1, nextReviewAt: iso(w.next_review_at), createdAt: iso(w.created_at),
        })),
      });
    }
    case "addWord": {
      const me = await requireUser(env, token);
      await ownSpace(env, me.id, num(a, "spaceId"));
      const r = await db.prepare("INSERT INTO words (space_id, word, meaning, ipa_uk, ipa_us, example, created_at) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id")
        .bind(num(a, "spaceId"), str(a, "word").trim(), str(a, "meaning").trim(), str(a, "ipaUk").trim(), str(a, "ipaUs").trim(), str(a, "example").trim(), Date.now())
        .first<{ id: number }>();
      need(r, "Không lưu được từ. Thử lại sau nhé.");
      return json({ id: r.id });
    }
    case "updateWord": case "deleteWord": case "setWordFlashcard": case "reviewFlashcard": {
      const me = await requireUser(env, token);
      const w = await db.prepare("SELECT * FROM words WHERE id = ?").bind(num(a, "wordId"))
        .first<{ id: number; space_id: number; next_review_at: number | null }>();
      need(w, "Không tìm thấy từ này.");
      await ownSpace(env, me.id, w.space_id);
      if (action === "updateWord") {
        await db.prepare("UPDATE words SET word = ?, meaning = ?, ipa_uk = ?, ipa_us = ?, example = ? WHERE id = ?")
          .bind(str(a, "word").trim(), str(a, "meaning").trim(), str(a, "ipaUk").trim(), str(a, "ipaUs").trim(), str(a, "example").trim(), w.id).run();
        return json({ ok: true });
      }
      if (action === "deleteWord") {
        await db.prepare("DELETE FROM words WHERE id = ?").bind(w.id).run();
        return json({ ok: true });
      }
      if (action === "setWordFlashcard") {
        const on = bool(a, "inFlashcards");
        await db.prepare("UPDATE words SET in_flashcards = ?, next_review_at = ? WHERE id = ?")
          .bind(on ? 1 : 0, on ? (w.next_review_at ?? Date.now()) : w.next_review_at, w.id).run();
        return json({ ok: true });
      }
      const next = new Date();
      next.setHours(0, 0, 0, 0);
      next.setDate(next.getDate() + (bool(a, "remembered") ? 3 : 1));
      await db.prepare("UPDATE words SET next_review_at = ? WHERE id = ?").bind(next.getTime(), w.id).run();
      return json({ nextReviewAt: next.toISOString() });
    }

    // ------------------------------------------------ notes
    case "listNotes": {
      const me = await requireUser(env, token);
      await ownSpace(env, me.id, num(a, "spaceId"));
      const { results } = await db.prepare("SELECT * FROM notes WHERE space_id = ? ORDER BY id DESC").bind(num(a, "spaceId"))
        .all<{ id: number; title: string; content: string; created_at: number; updated_at: number }>();
      return json({ notes: results.map((n) => ({ id: n.id, title: n.title, content: n.content, createdAt: iso(n.created_at), updatedAt: iso(n.updated_at) })) });
    }
    case "addNote": {
      const me = await requireUser(env, token);
      await ownSpace(env, me.id, num(a, "spaceId"));
      const now = Date.now();
      const r = await db.prepare("INSERT INTO notes (space_id, title, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?) RETURNING id")
        .bind(num(a, "spaceId"), str(a, "title").trim(), str(a, "content").trim(), now, now).first<{ id: number }>();
      need(r, "Không lưu được ghi nhớ. Thử lại sau nhé.");
      return json({ id: r.id });
    }
    case "updateNote": case "deleteNote": {
      const me = await requireUser(env, token);
      const n = await db.prepare("SELECT * FROM notes WHERE id = ?").bind(num(a, "noteId")).first<{ id: number; space_id: number }>();
      need(n, "Không tìm thấy ghi nhớ này.");
      await ownSpace(env, me.id, n.space_id);
      if (action === "updateNote") {
        await db.prepare("UPDATE notes SET title = ?, content = ?, updated_at = ? WHERE id = ?")
          .bind(str(a, "title").trim(), str(a, "content").trim(), Date.now(), n.id).run();
      } else {
        await db.prepare("DELETE FROM notes WHERE id = ?").bind(n.id).run();
      }
      return json({ ok: true });
    }

    // ------------------------------------------------ study sessions & goals
    case "listStudySessions": {
      const me = await requireUser(env, token);
      const { results } = await db.prepare(
        "SELECT s.*, sp.name AS space_name FROM study_sessions s LEFT JOIN spaces sp ON sp.id = s.space_id WHERE s.user_id = ? ORDER BY s.completed_at DESC",
      ).bind(me.id).all<{ id: number; space_id: number; space_name: string | null; title: string; minutes: number; completed_at: number }>();
      return json({
        sessions: results.map((s) => ({ id: s.id, spaceId: s.space_id, spaceName: s.space_name ?? "", title: s.title, minutes: s.minutes, completedAt: iso(s.completed_at) })),
      });
    }
    case "addStudySession": {
      const me = await requireUser(env, token);
      await ownSpace(env, me.id, num(a, "spaceId"));
      const completedAt = typeof a.completedAt === "string" ? new Date(a.completedAt).getTime() : Date.now();
      const r = await db.prepare("INSERT INTO study_sessions (user_id, space_id, title, minutes, completed_at, created_at) VALUES (?, ?, ?, ?, ?, ?) RETURNING id")
        .bind(me.id, num(a, "spaceId"), str(a, "title").trim() || "Buổi học", num(a, "minutes"), completedAt, Date.now()).first<{ id: number }>();
      need(r, "Không lưu được buổi học.");
      return json({ id: r.id });
    }
    case "deleteStudySession": {
      const me = await requireUser(env, token);
      await db.prepare("DELETE FROM study_sessions WHERE id = ? AND user_id = ?").bind(num(a, "sessionId"), me.id).run();
      return json({ ok: true });
    }
    case "listGoals": {
      const me = await requireUser(env, token);
      const { results } = await db.prepare("SELECT * FROM goals WHERE user_id = ? ORDER BY id ASC").bind(me.id)
        .all<{ id: number; type: string; target: number; deadline: string | null; created_at: number }>();
      const minutes = await db.prepare("SELECT COALESCE(SUM(minutes),0) AS v FROM study_sessions WHERE user_id = ?").bind(me.id).first<{ v: number }>();
      const sessions = await db.prepare("SELECT COUNT(*) AS v FROM study_sessions WHERE user_id = ?").bind(me.id).first<{ v: number }>();
      const words = await db.prepare("SELECT COUNT(*) AS v FROM words WHERE space_id IN (SELECT id FROM spaces WHERE user_id = ?)").bind(me.id).first<{ v: number }>();
      const progress = (t: string) => (t === "minutes" ? minutes?.v ?? 0 : t === "sessions" ? sessions?.v ?? 0 : words?.v ?? 0);
      return json({ goals: results.map((g) => ({ id: g.id, type: g.type, target: g.target, deadline: g.deadline, progress: progress(g.type), createdAt: iso(g.created_at) })) });
    }
    case "addGoal": {
      const me = await requireUser(env, token);
      const r = await db.prepare("INSERT INTO goals (user_id, type, target, deadline, created_at) VALUES (?, ?, ?, ?, ?) RETURNING id")
        .bind(me.id, str(a, "type"), num(a, "target"), typeof a.deadline === "string" && a.deadline ? a.deadline : null, Date.now()).first<{ id: number }>();
      need(r, "Không tạo được mục tiêu.");
      return json({ id: r.id });
    }
    case "updateGoal": {
      const me = await requireUser(env, token);
      await db.prepare("UPDATE goals SET type = ?, target = ?, deadline = ? WHERE id = ? AND user_id = ?")
        .bind(str(a, "type"), num(a, "target"), typeof a.deadline === "string" && a.deadline ? a.deadline : null, num(a, "goalId"), me.id).run();
      return json({ ok: true });
    }
    case "deleteGoal": {
      const me = await requireUser(env, token);
      await db.prepare("DELETE FROM goals WHERE id = ? AND user_id = ?").bind(num(a, "goalId"), me.id).run();
      return json({ ok: true });
    }

    // ------------------------------------------------ calendar events
    case "listCalendarEvents": {
      const me = await requireUser(env, token);
      await ownSpace(env, me.id, num(a, "spaceId"));
      const { results } = await db.prepare("SELECT * FROM calendar_events WHERE space_id = ? ORDER BY date ASC, start_time ASC").bind(num(a, "spaceId"))
        .all<{ id: number; space_id: number; title: string; note: string; date: string; end_date: string; start_time: string; end_time: string; color: string }>();
      return json({
        events: results.map((e) => ({
          id: e.id, spaceId: e.space_id, title: e.title, note: e.note, date: e.date,
          endDate: e.end_date || e.date, startTime: e.start_time, endTime: e.end_time, color: e.color,
        })),
      });
    }
    case "addCalendarEvent": {
      const me = await requireUser(env, token);
      await ownSpace(env, me.id, num(a, "spaceId"));
      const r = await db.prepare(
        "INSERT INTO calendar_events (space_id, title, note, date, end_date, start_time, end_time, color, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id",
      ).bind(num(a, "spaceId"), str(a, "title").trim(), str(a, "note").trim(), str(a, "date"), str(a, "endDate") || str(a, "date"), str(a, "startTime"), str(a, "endTime"), str(a, "color", "violet"), Date.now())
        .first<{ id: number }>();
      need(r, "Không lưu được sự kiện.");
      return json({ id: r.id });
    }
    case "updateCalendarEvent": case "deleteCalendarEvent": {
      const me = await requireUser(env, token);
      const e = await db.prepare("SELECT * FROM calendar_events WHERE id = ?").bind(num(a, "eventId")).first<{ id: number; space_id: number }>();
      need(e, "Không tìm thấy sự kiện này.");
      await ownSpace(env, me.id, e.space_id);
      if (action === "updateCalendarEvent") {
        await db.prepare("UPDATE calendar_events SET title = ?, note = ?, date = ?, end_date = ?, start_time = ?, end_time = ?, color = ? WHERE id = ?")
          .bind(str(a, "title").trim(), str(a, "note").trim(), str(a, "date"), str(a, "endDate") || str(a, "date"), str(a, "startTime"), str(a, "endTime"), str(a, "color", "violet"), e.id).run();
      } else {
        await db.prepare("DELETE FROM calendar_events WHERE id = ?").bind(e.id).run();
      }
      return json({ ok: true });
    }

    // ------------------------------------------------ donations
    case "createDonation": {
      const me = await requireUser(env, token);
      need(await donateEnabled(db), "Phần Donate đang tạm tắt. Cảm ơn bạn đã quan tâm nhé.");
      const amount = num(a, "amount");
      need(Number.isFinite(amount) && amount >= 1000, "Số tiền donate tối thiểu là 1.000 ₫ nhé.");
      const code = `LS-${randomHex(4).toUpperCase()}`;
      await db.prepare("INSERT INTO donations (donor_name, amount, note, code, status, user_id, created_at) VALUES (?, ?, '', ?, 'pending', ?, ?)")
        .bind(me.name, amount, code, me.id, Date.now()).run();
      return json({ code, amount });
    }
    case "listMyDonations": {
      const me = await requireUser(env, token);
      const { results } = await db.prepare("SELECT * FROM donations WHERE user_id = ? ORDER BY id DESC").bind(me.id)
        .all<{ id: number; donor_name: string; amount: number; note: string; code: string; status: string; created_at: number }>();
      return json({
        donations: results.map((d) => ({ id: d.id, donorName: d.donor_name, amount: d.amount, note: d.note, code: d.code, status: d.status, createdAt: iso(d.created_at) })),
      });
    }

    // ------------------------------------------------ admin (core subset)
    // The full admin surface of the Muse build (per-user permissions,
    // showcase numbers, goal options, bank info, contacts, password
    // resets) maps 1:1 onto app_settings + users; the endpoints below
    // cover the dashboard data and the most-used operations. Extend by
    // copying the matching defineAction from server/src/actions.ts —
    // the auth helpers (requireAdmin / requireUser) are identical.
    case "adminOverview": {
      await requireAdmin(env, token);
      const users = await db.prepare("SELECT COUNT(*) AS c FROM users").first<{ c: number }>();
      const spaces = await db.prepare("SELECT COUNT(*) AS c FROM spaces").first<{ c: number }>();
      const words = await db.prepare("SELECT COUNT(*) AS c FROM words").first<{ c: number }>();
      const sessions = await db.prepare("SELECT COUNT(*) AS c FROM study_sessions").first<{ c: number }>();
      const don = await db.prepare("SELECT COALESCE(SUM(amount),0) AS total, COUNT(*) AS c FROM donations WHERE status = 'confirmed'").first<{ total: number; c: number }>();
      const pending = await db.prepare("SELECT COUNT(*) AS c FROM donations WHERE status = 'pending'").first<{ c: number }>();
      const { results: userRows } = await db.prepare("SELECT * FROM users ORDER BY id ASC").all<UserRow>();
      const userList = [];
      for (const u of userRows) {
        const sc = await db.prepare("SELECT COUNT(*) AS c FROM spaces WHERE user_id = ?").bind(u.id).first<{ c: number }>();
        userList.push({
          id: u.id, name: u.name, email: u.email, role: u.role, permissions: parsePermissions(u.permissions),
          guest: u.guest === 1, locked: u.locked === 1, createdAt: iso(u.created_at), lastLoginAt: iso(u.last_login_at),
          spaceCount: sc?.c ?? 0, maxSpaces: u.max_spaces, phone: u.phone, birthDate: u.birth_date, birthYear: u.birth_year,
          gender: u.gender, language: u.language, nativeLanguage: u.native_language, learningLanguage: u.learning_language,
          theme: u.theme, sheetId: u.sheet_id, sheetConnected: u.sheet_connected === 1,
        });
      }
      const { results: donRows } = await db.prepare("SELECT * FROM donations ORDER BY id DESC").all<{ id: number; donor_name: string; amount: number; note: string; code: string; status: string; created_at: number }>();
      const readNum = async (key: string): Promise<number | null> => {
        const raw = await getSetting(db, key, "");
        if (!raw) return null;
        const n = Number.parseInt(raw, 10);
        return Number.isFinite(n) && n >= 0 ? n : null;
      };
      return json({
        stats: {
          users: users?.c ?? 0, spaces: spaces?.c ?? 0, words: words?.c ?? 0, sessions: sessions?.c ?? 0,
          donateTotal: don?.total ?? 0, donateCount: don?.c ?? 0, donatePendingCount: pending?.c ?? 0,
        },
        users: userList,
        donations: donRows.map((d) => ({ id: d.id, donorName: d.donor_name, amount: d.amount, note: d.note, code: d.code, status: d.status, createdAt: iso(d.created_at) })),
        maxSpaces: await getMaxSpaces(db),
        featureFlags: await featureFlags(db),
        bankInfo: await getBankInfo(db),
        donateEnabled: await donateEnabled(db),
        showcase: { users: await readNum("showcase_users"), fiveStar: await readNum("showcase_five_star"), downloads: await readNum("showcase_downloads") },
        goalOptions: await goalOptions(db),
        contacts: await contactLinks(db),
      });
    }
    case "adminSetDonateEnabled": {
      await requireAdmin(env, token);
      await setSetting(db, "donate_enabled", bool(a, "enabled") ? "1" : "0");
      return json({ ok: true });
    }
    case "adminSetMaxSpaces": {
      await requireAdmin(env, token);
      const v = num(a, "value");
      need(v >= 1 && v <= 100, "Giới hạn không gian phải từ 1 đến 100.");
      await setSetting(db, "max_spaces", String(v));
      return json({ ok: true });
    }
    case "adminSetFeatureFlag": {
      await requireAdmin(env, token);
      const flags = await featureFlags(db);
      flags[str(a, "featureKey")] = bool(a, "enabled");
      await setSetting(db, "feature_flags", JSON.stringify(flags));
      return json({ ok: true });
    }
    case "adminSetBankInfo": {
      await requireAdmin(env, token);
      await setSetting(db, "bank_info", JSON.stringify({ bank: str(a, "bank"), bankBin: str(a, "bankBin"), account: str(a, "account"), holder: str(a, "holder") }));
      return json({ ok: true });
    }
    case "adminSetDonationStatus": {
      await requireAdmin(env, token);
      await db.prepare("UPDATE donations SET status = ? WHERE id = ?").bind(str(a, "status"), num(a, "donationId")).run();
      return json({ ok: true });
    }
    case "adminDeleteDonation": {
      await requireAdmin(env, token);
      await db.prepare("DELETE FROM donations WHERE id = ?").bind(num(a, "donationId")).run();
      return json({ ok: true });
    }
    case "adminSetUserLocked": {
      await requireAdmin(env, token);
      await db.prepare("UPDATE users SET locked = ? WHERE id = ?").bind(bool(a, "locked") ? 1 : 0, num(a, "userId")).run();
      return json({ ok: true });
    }
    case "adminSetUserRole": {
      const admin = await requireAdmin(env, token);
      need(num(a, "userId") !== admin.id, "Bạn không thể tự đổi vai trò của mình.");
      await db.prepare("UPDATE users SET role = ? WHERE id = ?").bind(str(a, "role"), num(a, "userId")).run();
      return json({ ok: true });
    }
    case "adminIssueTempPassword": {
      await requireAdmin(env, token);
      const target = await db.prepare("SELECT * FROM users WHERE id = ?").bind(num(a, "userId")).first<UserRow>();
      need(target, "Không tìm thấy tài khoản này.");
      const temp = `LS-${randomHex(4).toUpperCase()}`;
      const salt = randomHex(16);
      await db.prepare("UPDATE users SET password_hash = ?, password_salt = ? WHERE id = ?")
        .bind(await hashPassword(temp, salt), salt, target.id).run();
      await db.prepare("DELETE FROM auth_sessions WHERE user_id = ?").bind(target.id).run();
      await db.prepare("UPDATE password_reset_requests SET status = 'done', resolved_at = ? WHERE user_id = ? AND status = 'pending'")
        .bind(Date.now(), target.id).run();
      // The plain temporary password is returned exactly once, to the admin.
      return json({ userName: target.name, email: target.email, tempPassword: temp });
    }
    case "adminListPasswordResets": {
      await requireAdmin(env, token);
      const { results } = await db.prepare("SELECT * FROM password_reset_requests WHERE status = 'pending' ORDER BY id DESC")
        .all<{ id: number; user_id: number | null; email: string; created_at: number }>();
      return json({ requests: results.map((r) => ({ id: r.id, userId: r.user_id, email: r.email, createdAt: iso(r.created_at) })) });
    }
    default:
      return fail(`Unknown action: ${action}`, 404);
  }
}

// ------------------------------------------------------------------ fetch
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const origin = url.origin;

    // Avatar files: the picture lives in D1 as a base64 data URI on the
    // user row (no R2), so decode and serve it straight from the database.
    if (request.method === "GET" && url.pathname.startsWith("/avatars/")) {
      const id = Number.parseInt(url.pathname.slice("/avatars/".length), 10);
      if (!Number.isFinite(id) || id <= 0) return new Response("Not found", { status: 404 });
      const row = await env.DB.prepare("SELECT avatar_data FROM users WHERE id = ?")
        .bind(id).first<{ avatar_data: string }>();
      const dataUri = row?.avatar_data ?? "";
      const match = /^data:(image\/(?:jpeg|png));base64,(.+)$/.exec(dataUri);
      if (!match) return new Response("Not found", { status: 404 });
      const bytes = base64ToBytes(match[2]!);
      if (!bytes) return new Response("Not found", { status: 404 });
      return new Response(bytes as BodyInit, {
        headers: {
          "content-type": match[1]!,
          "cache-control": "public, max-age=3600",
        },
      });
    }

    // API: POST /api/<action> with a JSON body (the action args).
    if (url.pathname.startsWith("/api/")) {
      if (request.method !== "POST") return fail("Method not allowed", 405);
      const action = url.pathname.slice("/api/".length);
      let args: Args = {};
      try {
        args = (await request.json()) as Args;
      } catch {
        return fail("Invalid JSON body");
      }
      try {
        return await handleAction(env, origin, action, args ?? {});
      } catch (e) {
        if (e instanceof ApiError) return fail(e.message);
        console.error("LaSpace worker error", action, e);
        return fail("Đã có lỗi xảy ra. Vui lòng thử lại nhé.", 500);
      }
    }

    // Everything else: the static frontend (SPA fallback configured in
    // wrangler.toml via not_found_handling).
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
