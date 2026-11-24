import type { ReactNode } from "react";
import { api, type ApiResponse } from "./api";

export type MeData = ApiResponse<typeof api, "me">;
export type PublicUser = MeData["user"];
export type SpaceItem = ApiResponse<typeof api, "listMySpaces">["spaces"][number];
export type WordItem = ApiResponse<typeof api, "listWords">["words"][number];
export type NoteItem = ApiResponse<typeof api, "listNotes">["notes"][number];
export type SessionItem = ApiResponse<typeof api, "listStudySessions">["sessions"][number];
export type GoalItem = ApiResponse<typeof api, "listGoals">["goals"][number];
export type AdminData = ApiResponse<typeof api, "adminOverview">;
export type AdminUserView = ApiResponse<typeof api, "adminGetUserView">;
export type PublicInfo = ApiResponse<typeof api, "getPublicInfo">;
export type ContactItem = PublicInfo["contacts"][number];
export type DonationItem = AdminData["donations"][number];

export function fmtMoney(n: number): string {
  return `${n.toLocaleString("vi-VN")} ₫`;
}

export type Lang = "vi" | "en" | "es" | "fr" | "de" | "ja" | "ko" | "zh";

export const LANGUAGES: { code: Lang; label: string }[] = [
  { code: "vi", label: "Tiếng Việt" },
  { code: "en", label: "English" },
  { code: "es", label: "Español" },
  { code: "fr", label: "Français" },
  { code: "de", label: "Deutsch" },
  { code: "ja", label: "日本語" },
  { code: "ko", label: "한국어" },
  { code: "zh", label: "中文" },
];

export function toLang(value: string): Lang {
  return (LANGUAGES.some((l) => l.code === value) ? value : "vi") as Lang;
}

// Languages a user can pick as the one they want to learn: the 8 interface
// languages plus other popular learning targets (stored as free codes).
export const LEARNING_LANGUAGES: { code: string; label: string }[] = [
  ...LANGUAGES,
  { code: "it", label: "Italiano" },
  { code: "pt", label: "Português" },
  { code: "ru", label: "Русский" },
  { code: "th", label: "ไทย" },
  { code: "hi", label: "हिन्दी" },
  { code: "ar", label: "العربية" },
];

export function localeOf(lang: Lang): string {
  return LOCALES[lang];
}

const LOCALES: Record<Lang, string> = {
  vi: "vi-VN",
  en: "en-GB",
  es: "es-ES",
  fr: "fr-FR",
  de: "de-DE",
  ja: "ja-JP",
  ko: "ko-KR",
  zh: "zh-CN",
};
// Each admin function is its own page (its own entry in the main sidebar);
// "admin" itself is the dashboard, which shows system data only.
export type AdminSectionId =
  | "rules"
  | "system"
  | "donate"
  | "password"
  | "resets"
  | "contacts"
  | "users"
  | "deploy";

export type View =
  | "home"
  | "store"
  | "settings"
  | "admin"
  | "admin-rules"
  | "admin-system"
  | "admin-donate"
  | "admin-password"
  | "admin-resets"
  | "admin-contacts"
  | "admin-users"
  | "admin-deploy"
  | "staff"
  | "space";

export const FEATURES: { key: string; icon: IconName }[] = [
  { key: "flashcards", icon: "layers" },
  { key: "vocab", icon: "book" },
  { key: "notes", icon: "edit" },
  { key: "quiz", icon: "help" },
  { key: "listening", icon: "headphones" },
  { key: "timer", icon: "clock" },
  { key: "goals", icon: "target" },
  { key: "calendar", icon: "calendar" },
];

// Vietnamese banks with their VietQR/Napas BIN codes, used to build
// pre-filled donation QR codes.
export const BANKS: { name: string; bin: string }[] = [
  { name: "Vietcombank", bin: "970436" },
  { name: "MB Bank", bin: "970422" },
  { name: "Techcombank", bin: "970407" },
  { name: "VietinBank", bin: "970415" },
  { name: "BIDV", bin: "970418" },
  { name: "Agribank", bin: "970405" },
  { name: "ACB", bin: "970416" },
  { name: "VPBank", bin: "970432" },
  { name: "TPBank", bin: "970423" },
  { name: "Sacombank", bin: "970403" },
  { name: "HDBank", bin: "970437" },
  { name: "VIB", bin: "970441" },
  { name: "SHB", bin: "970443" },
  { name: "Eximbank", bin: "970431" },
  { name: "MSB", bin: "970426" },
  { name: "OCB", bin: "970448" },
  { name: "SeABank", bin: "970440" },
  { name: "Nam A Bank", bin: "970428" },
  { name: "ABBANK", bin: "970425" },
  { name: "VietABank", bin: "970427" },
  { name: "SCB", bin: "970429" },
  { name: "PVcomBank", bin: "970412" },
  { name: "NCB", bin: "970419" },
  { name: "LPBank", bin: "970449" },
  { name: "Kienlongbank", bin: "970452" },
  { name: "BaoViet Bank", bin: "970438" },
  { name: "VietBank", bin: "970433" },
  { name: "PGBank", bin: "970430" },
  { name: "Shinhan Bank", bin: "970424" },
  { name: "HSBC", bin: "970458" },
];

// VietQR image URL: the donor's banking app reads the account, the exact
// amount and the transfer note (the donation code) straight from the code.
export function vietqrUrl(
  bank: { bankBin: string; account: string; holder: string },
  amount: number,
  note: string,
): string | null {
  if (!bank.bankBin || !bank.account) return null;
  const params = new URLSearchParams({
    amount: String(amount),
    addInfo: note,
    accountName: bank.holder,
  });
  return `https://img.vietqr.io/image/${bank.bankBin}-${bank.account}-compact2.png?${params.toString()}`;
}

// ---------------------------------------------------------------- icons
export type IconName =
  | "home" | "grid" | "gear" | "shield" | "plus" | "dots" | "logout"
  | "chevD" | "chevL" | "chevR" | "clock" | "layers" | "book" | "edit"
  | "help" | "headphones" | "target" | "play" | "pause" | "reset"
  | "volume" | "check" | "x" | "search" | "trash" | "download"
  | "calendar" | "bell" | "link" | "lock" | "users" | "star" | "heart";

const PATHS: Record<IconName, ReactNode> = {
  home: (<><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></>),
  grid: (<><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /></>),
  gear: (<><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1" /></>),
  shield: (<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />),
  plus: (<path d="M12 5v14M5 12h14" />),
  dots: (<><circle cx="12" cy="5" r="1.7" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1.7" fill="currentColor" stroke="none" /><circle cx="12" cy="19" r="1.7" fill="currentColor" stroke="none" /></>),
  logout: (<><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></>),
  chevD: (<polyline points="6 9 12 15 18 9" />),
  chevL: (<polyline points="15 18 9 12 15 6" />),
  chevR: (<polyline points="9 18 15 12 9 6" />),
  clock: (<><circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 16 14" /></>),
  layers: (<><polygon points="12 2 2 7 12 12 22 7 12 2" /><polyline points="2 17 12 22 22 17" /><polyline points="2 12 12 17 22 12" /></>),
  book: (<><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" /></>),
  edit: (<><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" /></>),
  help: (<><circle cx="12" cy="12" r="9" /><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" /></>),
  headphones: (<><path d="M3 18v-6a9 9 0 0 1 18 0v6" /><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" /></>),
  target: (<><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" /></>),
  play: (<polygon points="6 3 20 12 6 21 6 3" fill="currentColor" stroke="none" />),
  pause: (<><line x1="9" y1="5" x2="9" y2="19" strokeWidth="3.2" /><line x1="15" y1="5" x2="15" y2="19" strokeWidth="3.2" /></>),
  reset: (<><polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" /></>),
  volume: (<><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" /></>),
  check: (<polyline points="20 6 9 17 4 12" />),
  x: (<><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>),
  search: (<><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.5" y2="16.5" /></>),
  trash: (<><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></>),
  download: (<><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></>),
  calendar: (<><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></>),
  bell: (<><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></>),
  link: (<><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></>),
  lock: (<><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></>),
  users: (<><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>),
  star: (<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />),
  heart: (<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />),
};

export function Icon({ name, size = 15 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ flexShrink: 0 }}
    >
      {PATHS[name]}
    </svg>
  );
}

// ---------------------------------------------------------------- i18n
const STR = {
  home: { vi: "Trang chính", en: "Home", es: "Inicio", fr: "Accueil", de: "Start", ja: "ホーム", ko: "홈", zh: "主页" },
  store: { vi: "Kho tính năng", en: "Feature store", es: "Tienda de funciones", fr: "Catalogue de fonctions", de: "Funktionskatalog", ja: "機能ストア", ko: "기능 스토어", zh: "功能商店" },
  settings: { vi: "Cài đặt", en: "Settings", es: "Ajustes", fr: "Réglages", de: "Einstellungen", ja: "設定", ko: "설정", zh: "设置" },
  adminDash: { vi: "Dashboard Admin", en: "Admin dashboard", es: "Panel de administración", fr: "Tableau de bord admin", de: "Admin-Dashboard", ja: "管理ダッシュボード", ko: "관리자 대시보드", zh: "管理员面板" },
  adminSection: { vi: "QUẢN TRỊ", en: "ADMIN", es: "ADMINISTRACIÓN", fr: "ADMINISTRATION", de: "VERWALTUNG", ja: "管理", ko: "관리", zh: "管理" },
  mySpaces: { vi: "KHÔNG GIAN CỦA TÔI", en: "MY SPACES", es: "MIS ESPACIOS", fr: "MES ESPACES", de: "MEINE BEREICHE", ja: "マイスペース", ko: "내 공간", zh: "我的空间" },
  createSpace: { vi: "Tạo không gian mới", en: "Create a new space", es: "Crear un espacio nuevo", fr: "Créer un nouvel espace", de: "Neuen Bereich erstellen", ja: "新しいスペースを作成", ko: "새 공간 만들기", zh: "创建新空间" },
  logout: { vi: "Đăng xuất", en: "Log out", es: "Cerrar sesión", fr: "Se déconnecter", de: "Abmelden", ja: "ログアウト", ko: "로그아웃", zh: "退出登录" },
  userAccount: { vi: "Tài khoản học viên", en: "Learner account", es: "Cuenta de estudiante", fr: "Compte apprenant", de: "Lernkonto", ja: "学習者アカウント", ko: "학습자 계정", zh: "学员账号" },
  guestAccount: { vi: "Không gian khách", en: "Guest space", es: "Espacio de invitado", fr: "Espace invité", de: "Gastbereich", ja: "ゲストスペース", ko: "게스트 공간", zh: "访客空间" },
  adminAccount: { vi: "Tài khoản Admin", en: "Admin account", es: "Cuenta de administrador", fr: "Compte admin", de: "Admin-Konto", ja: "管理者アカウント", ko: "관리자 계정", zh: "管理员账号" },
  greeting: {
    vi: "Hay quá bạn quay lại học rồi, Cố gắng hoàn thành mục tiêu nhé",
    en: "Great to see you back — keep pushing toward your goal",
    es: "¡Qué bien que volviste a estudiar! Sigue avanzando hacia tu meta",
    fr: "Ravi de te revoir — continue vers ton objectif",
    de: "Schön, dass du wieder lernst — bleib an deinem Ziel dran",
    ja: "おかえりなさい。目標に向かってがんばりましょう",
    ko: "다시 공부하러 와서 좋아요. 목표를 향해 계속 가요",
    zh: "欢迎回来学习,继续向目标前进吧",
  },
  welcomeBack: { vi: "Chào mừng bạn quay lại góc học của mình", en: "Welcome back to your learning corner", es: "Bienvenido de nuevo a tu rincón de estudio", fr: "Bon retour dans ton coin d'étude", de: "Willkommen zurück in deiner Lernecke", ja: "学習コーナーへおかえりなさい", ko: "학습 코너에 다시 오신 것을 환영해요", zh: "欢迎回到你的学习角" },
  studyStats: { vi: "Thời gian học & Mục tiêu của bạn", en: "Your study time & goals", es: "Tu tiempo de estudio y metas", fr: "Ton temps d'étude et tes objectifs", de: "Deine Lernzeit & Ziele", ja: "学習時間と目標", ko: "학습 시간 & 목표", zh: "你的学习时间与目标" },
  totalStudy: { vi: "Tổng thời gian đã học", en: "Total study time", es: "Tiempo total de estudio", fr: "Temps d'étude total", de: "Gesamte Lernzeit", ja: "総学習時間", ko: "총 학습 시간", zh: "总学习时间" },
  today: { vi: "Hôm nay", en: "Today", es: "Hoy", fr: "Aujourd'hui", de: "Heute", ja: "今日", ko: "오늘", zh: "今天" },
  last7: { vi: "7 ngày gần đây", en: "Last 7 days", es: "Últimos 7 días", fr: "7 derniers jours", de: "Letzte 7 Tage", ja: "過去7日間", ko: "최근 7일", zh: "最近7天" },
  sessionsDone: { vi: "Buổi đã hoàn thành", en: "Sessions completed", es: "Sesiones completadas", fr: "Séances terminées", de: "Abgeschlossene Einheiten", ja: "完了したセッション", ko: "완료한 세션", zh: "已完成课程" },
  goalsDone: { vi: "Mục tiêu đã xong", en: "Goals completed", es: "Metas completadas", fr: "Objectifs atteints", de: "Ziele erreicht", ja: "達成した目標", ko: "완료한 목표", zh: "已完成目标" },
  avgProgress: { vi: "Tiến độ trung bình", en: "Average progress", es: "Progreso medio", fr: "Progression moyenne", de: "Durchschnittlicher Fortschritt", ja: "平均進捗", ko: "평균 진행률", zh: "平均进度" },
  minutes: { vi: "phút", en: "min", es: "min", fr: "min", de: "Min.", ja: "分", ko: "분", zh: "分钟" },
  noSpacesYet: { vi: "Bạn chưa có không gian nào. Tạo không gian đầu tiên để bắt đầu học nhé.", en: "You have no spaces yet. Create your first space to start learning.", es: "Aún no tienes espacios. Crea el primero para empezar a aprender.", fr: "Tu n'as pas encore d'espace. Crée le premier pour commencer.", de: "Du hast noch keine Bereiche. Erstelle den ersten, um zu starten.", ja: "まだスペースがありません。最初のスペースを作って始めましょう。", ko: "아직 공간이 없어요. 첫 공간을 만들어 시작하세요.", zh: "你还没有空间。创建第一个空间开始学习吧。" },
  openSpace: { vi: "Mở không gian", en: "Open space", es: "Abrir espacio", fr: "Ouvrir l'espace", de: "Bereich öffnen", ja: "スペースを開く", ko: "공간 열기", zh: "打开空间" },
  words: { vi: "từ", en: "words", es: "palabras", fr: "mots", de: "Wörter", ja: "単語", ko: "단어", zh: "单词" },
  rename: { vi: "Sửa tên", en: "Rename", es: "Renombrar", fr: "Renommer", de: "Umbenennen", ja: "名前を変更", ko: "이름 변경", zh: "重命名" },
  deleteSpace: { vi: "Xóa không gian", en: "Delete space", es: "Eliminar espacio", fr: "Supprimer l'espace", de: "Bereich löschen", ja: "スペースを削除", ko: "공간 삭제", zh: "删除空间" },
  confirmDeleteSpace: { vi: "Xóa không gian này? Toàn bộ từ vựng, ghi nhớ và buổi học trong đó sẽ bị xóa.", en: "Delete this space? All its words, notes and sessions will be removed.", es: "¿Eliminar este espacio? Se borrarán todas sus palabras, notas y sesiones.", fr: "Supprimer cet espace ? Tous ses mots, notes et séances seront effacés.", de: "Diesen Bereich löschen? Alle Wörter, Notizen und Einheiten werden entfernt.", ja: "このスペースを削除しますか？単語・メモ・セッションはすべて削除されます。", ko: "이 공간을 삭제할까요? 단어, 메모, 세션이 모두 삭제됩니다.", zh: "删除这个空间?其中的单词、笔记和课程都会被删除。" },
  cancel: { vi: "Hủy", en: "Cancel", es: "Cancelar", fr: "Annuler", de: "Abbrechen", ja: "キャンセル", ko: "취소", zh: "取消" },
  delete: { vi: "Xóa", en: "Delete", es: "Eliminar", fr: "Supprimer", de: "Löschen", ja: "削除", ko: "삭제", zh: "删除" },
  save: { vi: "Lưu", en: "Save", es: "Guardar", fr: "Enregistrer", de: "Speichern", ja: "保存", ko: "저장", zh: "保存" },
  add: { vi: "Thêm", en: "Add", es: "Añadir", fr: "Ajouter", de: "Hinzufügen", ja: "追加", ko: "추가", zh: "添加" },
  edit: { vi: "Sửa", en: "Edit", es: "Editar", fr: "Modifier", de: "Bearbeiten", ja: "編集", ko: "수정", zh: "编辑" },
  close: { vi: "Đóng", en: "Close", es: "Cerrar", fr: "Fermer", de: "Schließen", ja: "閉じる", ko: "닫기", zh: "关闭" },
  search: { vi: "Tìm kiếm", en: "Search", es: "Buscar", fr: "Rechercher", de: "Suchen", ja: "検索", ko: "검색", zh: "搜索" },
  storeIntro: { vi: "Chọn tính năng để thêm vào không gian của bạn.", en: "Pick features to add into your space.", es: "Elige funciones para añadir a tu espacio.", fr: "Choisis des fonctions à ajouter à ton espace.", de: "Wähle Funktionen für deinen Bereich.", ja: "スペースに追加する機能を選んでください。", ko: "공간에 추가할 기능을 선택하세요.", zh: "选择要添加到空间的功能。" },
  addToSpace: { vi: "Thêm vào không gian", en: "Add to space", es: "Añadir al espacio", fr: "Ajouter à l'espace", de: "Zum Bereich hinzufügen", ja: "スペースに追加", ko: "공간에 추가", zh: "添加到空间" },
  added: { vi: "Đã thêm", en: "Added", es: "Añadido", fr: "Ajouté", de: "Hinzugefügt", ja: "追加済み", ko: "추가됨", zh: "已添加" },
  removeFeature: { vi: "Gỡ khỏi không gian", en: "Remove from space", es: "Quitar del espacio", fr: "Retirer de l'espace", de: "Aus Bereich entfernen", ja: "スペースから削除", ko: "공간에서 제거", zh: "从空间移除" },
  featureOff: { vi: "Đang tạm tắt", en: "Temporarily off", es: "Desactivado temporalmente", fr: "Temporairement désactivé", de: "Vorübergehend aus", ja: "一時的にオフ", ko: "일시적으로 꺼짐", zh: "暂时关闭" },
  pickSpaceFirst: { vi: "Hãy tạo hoặc chọn một không gian trước nhé.", en: "Create or pick a space first.", es: "Primero crea o elige un espacio.", fr: "Crée ou choisis d'abord un espace.", de: "Erstelle oder wähle zuerst einen Bereich.", ja: "まずスペースを作成または選択してください。", ko: "먼저 공간을 만들거나 선택하세요.", zh: "请先创建或选择一个空间。" },
  spaceFeatures: { vi: "Tính năng trong không gian", en: "Features in this space", es: "Funciones de este espacio", fr: "Fonctions de cet espace", de: "Funktionen in diesem Bereich", ja: "このスペースの機能", ko: "이 공간의 기능", zh: "此空间的功能" },
  noFeaturesYet: { vi: "Không gian này chưa có tính năng nào. Vào Kho tính năng để thêm nhé.", en: "This space has no features yet. Open the Feature store to add some.", es: "Este espacio aún no tiene funciones. Abre la Tienda de funciones para añadir algunas.", fr: "Cet espace n'a pas encore de fonctions. Ouvre le catalogue pour en ajouter.", de: "Dieser Bereich hat noch keine Funktionen. Öffne den Katalog, um welche hinzuzufügen.", ja: "このスペースにはまだ機能がありません。機能ストアから追加してください。", ko: "이 공간에는 아직 기능이 없어요. 기능 스토어에서 추가하세요.", zh: "此空间还没有功能。打开功能商店添加吧。" },
  back: { vi: "Quay lại", en: "Back", es: "Atrás", fr: "Retour", de: "Zurück", ja: "戻る", ko: "뒤로", zh: "返回" },
} as const;

export type StrKey = keyof typeof STR;
export function t(lang: Lang, key: StrKey): string {
  return STR[key][lang];
}

export const FEATURE_TEXT: Record<string, { name: Record<Lang, string>; desc: Record<Lang, string> }> = {
  flashcards: {
    name: { vi: "Flashcards", en: "Flashcards", es: "Flashcards", fr: "Flashcards", de: "Karteikarten", ja: "フラッシュカード", ko: "플래시카드", zh: "闪卡" },
    desc: { vi: "Ôn từ theo lịch nhớ — nhớ rồi ôn sau 3 ngày, chưa nhớ ôn ngày mai.", en: "Spaced review — remembered cards return in 3 days, others tomorrow.", es: "Repaso espaciado: las tarjetas aprendidas vuelven en 3 días, las demás mañana.", fr: "Révision espacée : les cartes sues reviennent dans 3 jours, les autres demain.", de: "Wiederholung mit Abstand — gewusste Karten kommen in 3 Tagen, andere morgen.", ja: "間隔反復：覚えたカードは3日後、まだのカードは明日復習。", ko: "간격 반복 복습 — 외운 카드는 3일 뒤, 아닌 카드는 내일 복습해요.", zh: "间隔复习：记住的卡片3天后复习，没记住的明天复习。" },
  },
  vocab: {
    name: { vi: "Sổ tay từ vựng", en: "Vocabulary notebook", es: "Cuaderno de vocabulario", fr: "Carnet de vocabulaire", de: "Vokabelheft", ja: "単語ノート", ko: "단어장", zh: "词汇手册" },
    desc: { vi: "Lưu từ mới kèm nghĩa, phiên âm IPA và ví dụ.", en: "Save new words with meaning, IPA transcription and examples.", es: "Guarda palabras nuevas con significado, transcripción IPA y ejemplos.", fr: "Enregistre des mots avec sens, transcription API et exemples.", de: "Speichere neue Wörter mit Bedeutung, IPA-Umschrift und Beispielen.", ja: "意味・IPA発音記号・例文つきで新しい単語を保存。", ko: "뜻, IPA 발음 기호, 예문과 함께 새 단어를 저장해요.", zh: "保存新单词，附释义、IPA 音标和例句。" },
  },
  notes: {
    name: { vi: "Sổ ghi nhớ", en: "Notes", es: "Notas", fr: "Notes", de: "Notizen", ja: "メモ", ko: "메모", zh: "记事本" },
    desc: { vi: "Ghi lại ngữ pháp, mẹo học và mọi điều cần nhớ.", en: "Jot down grammar, tips and anything to remember.", es: "Apunta gramática, trucos y todo lo que quieras recordar.", fr: "Note grammaire, astuces et tout ce qu'il faut retenir.", de: "Notiere Grammatik, Tipps und alles Wichtige.", ja: "文法やコツ、覚えたいことをメモ。", ko: "문법, 팁, 기억할 내용을 적어 두세요.", zh: "记录语法、学习技巧和需要记住的内容。" },
  },
  quiz: {
    name: { vi: "Quiz nhanh", en: "Quick quiz", es: "Quiz rápido", fr: "Quiz rapide", de: "Schnellquiz", ja: "クイッククイズ", ko: "빠른 퀴즈", zh: "快速测验" },
    desc: { vi: "Trả lời nhanh vài câu để kiểm tra kiến thức.", en: "Answer a few quick questions to check yourself.", es: "Responde unas preguntas rápidas para comprobar lo que sabes.", fr: "Réponds à quelques questions rapides pour te tester.", de: "Beantworte ein paar schnelle Fragen zur Selbstkontrolle.", ja: "数問のクイック質問で理解度をチェック。", ko: "빠른 질문 몇 개로 실력을 확인하세요.", zh: "回答几道快速题，检查自己的掌握情况。" },
  },
  listening: {
    name: { vi: "Luyện nghe", en: "Listening", es: "Comprensión auditiva", fr: "Écoute", de: "Hörverstehen", ja: "リスニング", ko: "듣기 연습", zh: "听力练习" },
    desc: { vi: "Nghe câu trong ngôn ngữ bạn đang học và chọn lại đúng câu vừa nghe.", en: "Listen to sentences in the language you are learning and pick the one you heard.", es: "Escucha frases en el idioma que estás aprendiendo y elige la que acabas de oír.", fr: "Écoute des phrases dans la langue que tu apprends et choisis celle que tu as entendue.", de: "Höre Sätze in der Sprache, die du lernst, und wähle den gehörten aus.", ja: "学習中の言語の文を聞いて、聞いた文を選ぼう。", ko: "학습 중인 언어의 문장을 듣고 들은 문장을 고르세요.", zh: "听你正在学习的语言的句子，选出你听到的那一句。" },
  },
  timer: {
    name: { vi: "Đồng hồ học", en: "Study timer", es: "Temporizador de estudio", fr: "Minuteur d'étude", de: "Lerntimer", ja: "学習タイマー", ko: "학습 타이머", zh: "学习计时器" },
    desc: { vi: "Đếm giờ học tự do hoặc Pomodoro, lưu lại từng buổi học.", en: "Free count-up or Pomodoro timer that saves every session.", es: "Cronómetro libre o Pomodoro que guarda cada sesión.", fr: "Chronomètre libre ou Pomodoro qui enregistre chaque séance.", de: "Freier Timer oder Pomodoro — speichert jede Einheit.", ja: "自由カウントまたはポモドーロ。各セッションを保存。", ko: "자유 타이머 또는 포모도로, 세션마다 저장돼요.", zh: "自由计时或番茄钟，保存每一次学习。" },
  },
  goals: {
    name: { vi: "Mục tiêu học tập", en: "Learning goals", es: "Metas de aprendizaje", fr: "Objectifs d'apprentissage", de: "Lernziele", ja: "学習目標", ko: "학습 목표", zh: "学习目标" },
    desc: { vi: "Đặt mục tiêu phút học, từ vựng, buổi học và theo dõi tiến độ.", en: "Set minute, word and session goals and track progress.", es: "Fija metas de minutos, palabras y sesiones y sigue tu progreso.", fr: "Définis des objectifs de minutes, mots et séances et suis tes progrès.", de: "Setze Ziele für Minuten, Wörter und Einheiten und verfolge den Fortschritt.", ja: "分・単語・セッションの目標を設定して進捗を確認。", ko: "분, 단어, 세션 목표를 세우고 진행 상황을 확인하세요.", zh: "设定分钟、单词、课程目标并跟踪进度。" },
  },
  calendar: {
    name: { vi: "Lịch học", en: "Study calendar", es: "Calendario de estudio", fr: "Calendrier d'étude", de: "Lernkalender", ja: "学習カレンダー", ko: "학습 달력", zh: "学习日历" },
    desc: { vi: "Lịch kiểu Google Calendar: xem theo tháng, tuần hoặc lịch trình, tự thêm sự kiện học có giờ và màu riêng, kèm buổi học, từ cần ôn và hạn mục tiêu.", en: "A Google-Calendar-style calendar: month, week and agenda views, your own timed colour-coded study events, plus sessions, due words and goal deadlines.", es: "Ve sesiones, palabras por repasar y plazos día a día en un calendario mensual.", fr: "Vois séances, mots à réviser et échéances jour par jour sur un calendrier mensuel.", de: "Sieh Einheiten, fällige Wörter und Zieltermine Tag für Tag im Monatskalender.", ja: "学習セッション・復習単語・目標期限を月カレンダーで日ごとに確認。", ko: "학습 세션, 복습 단어, 목표 마감일을 월 달력에서 날짜별로 확인하세요.", zh: "在月历上按天查看学习课程、待复习单词和目标截止日期。" },
  },
};

// ---------------------------------------------------------------- helpers
export function fmtDateTime(iso: string, lang: Lang): string {
  const d = new Date(iso);
  return d.toLocaleString(LOCALES[lang], {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
export function fmtDate(iso: string, lang: Lang): string {
  const d = new Date(iso);
  return d.toLocaleDateString(LOCALES[lang], {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}
export function dayKey(iso: string): string {
  const d = new Date(iso);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}
export function todayKey(): string {
  return dayKey(new Date().toISOString());
}
export function isDue(iso: string | null): boolean {
  if (!iso) return true;
  // Due is a per-day concept: a word scheduled for today is reviewable all day.
  return dayKey(iso) <= todayKey();
}
export function fmtClock(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}
export function speak(text: string) {
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-US";
    u.rate = 0.92;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  } catch {
    /* device TTS unavailable */
  }
}
export function beep() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ac = new Ctx();
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.15, ac.currentTime);
    osc.start();
    osc.stop(ac.currentTime + 0.35);
  } catch {
    /* audio unavailable */
  }
}
export function notifyDone(title: string, body: string) {
  try {
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(title, { body });
    }
  } catch {
    /* notifications unavailable */
  }
}
export function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows
    .map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(","))
    .join("\r\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
export function extractSheetId(value: string): string | null {
  const m = value.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (m?.[1]) return m[1];
  return /^[a-zA-Z0-9_-]{10,}$/.test(value.trim()) ? value.trim() : null;
}
