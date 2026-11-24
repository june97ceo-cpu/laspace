import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";
import {
Icon,
beep,
dayKey,
downloadCsv,
fmtClock,
fmtDate,
notifyDone,
t,
type GoalItem,
type Lang,
type PublicUser,
} from "./lib";
import { localeOf } from "./lib";
import { tx, txf } from "./i18n";
import { ConfirmDialog, Pager } from "./shared";

// ================================================================ Timer
export function TimerView({
  token,
  lang,
  spaceId,
  user,
  onUserChange,
}: {
  token: string;
  lang: Lang;
  spaceId: number;
  user: PublicUser;
  onUserChange: (u: PublicUser) => void;
}) {
  const L = lang === "vi";
  const queryClient = useQueryClient();
  const sessionsQ = useQuery({
    queryKey: ["sessions", spaceId],
    queryFn: () => api.listStudySessions({ token, spaceId }),
  });

  const [mode, setMode] = useState<"free" | "pomo">("free");
  const [phase, setPhase] = useState<"focus" | "break">("focus");
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0); // seconds counted up this phase
  const [title, setTitle] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [focusMin, setFocusMin] = useState(user.pomoFocus);
  const [breakMin, setBreakMin] = useState(user.pomoBreak);
  const [notify, setNotify] = useState(user.pomoNotify);
  const [dateSearch, setDateSearch] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [pageIdx, setPageIdx] = useState(0);
  const [notice, setNotice] = useState("");
  const savedRef = useRef(false);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["sessions", spaceId] });
    queryClient.invalidateQueries({ queryKey: ["sessions", "all"] });
    queryClient.invalidateQueries({ queryKey: ["goals"] });
  };
  const addSession = useMutation({
    mutationFn: (args: { title: string; minutes: number }) =>
      api.addStudySession({ token, spaceId, title: args.title, minutes: args.minutes }),
    // Once the server confirms the save, the title box clears for the
    // next session.
    onSuccess: () => { invalidate(); setTitle(""); },
  });
  const updateSession = useMutation({
    mutationFn: (args: { id: number; title: string }) =>
      api.updateStudySession({ token, sessionId: args.id, title: args.title }),
    onSuccess: () => { invalidate(); setEditingId(null); },
  });
  const deleteSession = useMutation({
    mutationFn: (id: number) => api.deleteStudySession({ token, sessionId: id }),
    onSuccess: () => { invalidate(); setConfirmDelete(null); },
  });
  const savePrefs = useMutation({
    mutationFn: () =>
      api.updatePreferences({ token, pomoFocus: focusMin, pomoBreak: breakMin, pomoNotify: notify }),
    onSuccess: (r) => { onUserChange(r.user); setSettingsOpen(false); },
  });

  const phaseTotal = mode === "free" ? 3600 : (phase === "focus" ? focusMin : breakMin) * 60;
  const progress = mode === "free" ? (elapsed % 3600) / 3600 : Math.min(1, elapsed / phaseTotal);
  const displaySeconds = mode === "pomo" ? Math.max(0, phaseTotal - elapsed) : elapsed;

  useEffect(() => {
    if (!running) return;
    const iv = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(iv);
  }, [running]);

  useEffect(() => {
    if (mode !== "pomo" || !running) return;
    if (elapsed < phaseTotal) return;
    // Phase finished.
    if (notify) {
      beep();
      notifyDone("LaSpace", phase === "focus" ? (tx(lang, "Hết giờ tập trung!", "Focus time is up!")) : (tx(lang, "Hết giờ nghỉ!", "Break is over!")));
    }
    if (phase === "focus") {
      if (!savedRef.current) {
        savedRef.current = true;
        addSession.mutate({
          title: title.trim() || (tx(lang, "Buổi học Pomodoro", "Pomodoro session")),
          minutes: focusMin,
        });
        setNotice(tx(lang, "Đã lưu buổi học vào danh sách bên dưới.", "Session saved to the list below."));
      }
      setPhase("break");
      setElapsed(0);
    } else {
      setPhase("focus");
      setElapsed(0);
      savedRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elapsed, mode, running, phase, phaseTotal]);

  const reset = () => {
    setRunning(false);
    setElapsed(0);
    setPhase("focus");
    savedRef.current = false;
  };

  const finishFree = () => {
    const minutes = Math.floor(elapsed / 60);
    if (minutes < 1) {
      setNotice(tx(lang, "Hãy học ít nhất 1 phút rồi lưu nhé.", "Study at least 1 minute before saving."));
      return;
    }
    addSession.mutate({
      title: title.trim() || (tx(lang, "Buổi học tự do", "Free study session")),
      minutes,
    });
    setNotice(tx(lang, "Đã lưu buổi học vào danh sách bên dưới.", "Session saved to the list below."));
    reset();
  };

  const sessions = sessionsQ.data?.sessions ?? [];
  const filtered = useMemo(() => {
    if (!dateSearch) return sessions;
    return sessions.filter((s) => dayKey(s.completedAt) === dateSearch);
  }, [sessions, dateSearch]);
  const safeIdx = Math.min(pageIdx, Math.max(0, filtered.length - 1));

  const exportCsv = () => {
    const rows: string[][] = [
      [tx(lang, "Tiêu đề", "Title"), tx(lang, "Số phút học", "Minutes"), tx(lang, "Ngày hoàn thành", "Date"), tx(lang, "Giờ hoàn thành", "Time")],
      ...sessions.map((s) => {
        const d = new Date(s.completedAt);
        return [
          s.title,
          String(s.minutes),
          d.toLocaleDateString("vi-VN"),
          d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
        ];
      }),
    ];
    downloadCsv("laspace-buoi-hoc.csv", rows);
  };

  const R = 84;
  const CIRC = 2 * Math.PI * R;

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-center gap-2">
        <button type="button" className={`tabbtn ${mode === "free" ? "active" : ""}`} onClick={() => { setMode("free"); reset(); }}>
          {tx(lang, "Đếm tự do", "Free timer")}
        </button>
        <button type="button" className={`tabbtn ${mode === "pomo" ? "active" : ""}`} onClick={() => { setMode("pomo"); reset(); }}>
          Pomodoro
        </button>
        {mode === "pomo" ? (
          <button type="button" className="btn btn-sm" onClick={() => setSettingsOpen((v) => !v)} aria-label={tx(lang, "Cài đặt Pomodoro", "Pomodoro settings")} aria-expanded={settingsOpen}>
            <Icon name="gear" size={13} />
          </button>
        ) : null}
      </div>

      {settingsOpen && mode === "pomo" ? (
        <div className="card grid gap-2 p-2.5">
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span style={{ color: "var(--dim)" }}>{tx(lang, "Thời gian đếm (phút)", "Focus (minutes)")}</span>
              <input min={1} max={180} type="number" className="input" value={focusMin} onChange={(e) => setFocusMin(Number(e.target.value))} />
            </label>
            <label className="block">
              <span style={{ color: "var(--dim)" }}>{tx(lang, "Thời gian nghỉ (phút)", "Break (minutes)")}</span>
              <input min={1} max={60} type="number" className="input" value={breakMin} onChange={(e) => setBreakMin(Number(e.target.value))} />
            </label>
          </div>
          <label className="flex min-h-8 cursor-pointer items-center gap-2">
            <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} className="h-4 w-4" />
            <Icon name="bell" size={13} /> {tx(lang, "Thông báo khi hết giờ", "Notify when time is up")}
          </label>
          <div>
            <button type="button" className="btn btn-orange" onClick={() => savePrefs.mutate()} disabled={savePrefs.isPending}>
              {t(lang, "save")}
            </button>
          </div>
        </div>
      ) : null}

      <div className="flex flex-col items-center gap-2">
        <div className="relative" style={{ width: 200, height: 200 }}>
          <svg width="200" height="200" viewBox="0 0 200 200">
            <defs>
              <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#2f6bff" />
                <stop offset="55%" stopColor="#7c3aed" />
                <stop offset="100%" stopColor={phase === "break" ? "#34d399" : "#ff8a3d"} />
              </linearGradient>
            </defs>
            <circle cx="100" cy="100" r={R} fill="var(--surface)" stroke="var(--track)" strokeWidth="12" />
            <circle
              cx="100"
              cy="100"
              r={R}
              fill="none"
              stroke="url(#ringGrad)"
              strokeWidth="12"
              strokeLinecap="round"
              strokeDasharray={CIRC}
              strokeDashoffset={CIRC * (1 - progress)}
              transform="rotate(-90 100 100)"
              style={{ transition: "stroke-dashoffset 0.6s linear" }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-display text-4xl font-extrabold">{fmtClock(displaySeconds)}</span>
            <span style={{ color: "var(--dim)" }}>
              {mode === "pomo" ? (phase === "focus" ? (tx(lang, "Đang tập trung", "Focusing")) : (tx(lang, "Đang nghỉ", "On break"))) : (tx(lang, "Đang đếm giờ học", "Counting study time"))}
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn btn-primary btn-lg" onClick={() => setRunning((v) => !v)} aria-label={running ? (tx(lang, "Tạm dừng", "Pause")) : (tx(lang, "Bắt đầu", "Start"))} title={running ? (tx(lang, "Tạm dừng đồng hồ học", "Pause the study timer")) : (tx(lang, "Bắt đầu đếm giờ học", "Start the study timer"))}>
            <Icon name={running ? "pause" : "play"} size={14} /> {running ? (tx(lang, "Tạm dừng", "Pause")) : (tx(lang, "Bắt đầu", "Start"))}
          </button>
          <button type="button" className="btn btn-lg" onClick={reset} aria-label={tx(lang, "Đặt lại", "Reset")} title={tx(lang, "Đặt đồng hồ về 0 và bắt đầu lại", "Reset the timer to zero")}>
            <Icon name="reset" size={14} /> {tx(lang, "Đặt lại", "Reset")}
          </button>
        </div>
      </div>

      <div className="card grid gap-2 p-2.5">
        <label className="block">
          <span style={{ color: "var(--dim)" }}>{tx(lang, "Tiêu đề buổi học", "Session title")}</span>
          <input maxLength={120} required className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={tx(lang, "Ví dụ: Ôn từ vựng bài 5", "e.g. Review lesson 5 vocab")} />
        </label>
        {mode === "free" ? (
          <div>
            <button type="button" className="btn btn-orange" onClick={finishFree} disabled={addSession.isPending} title={tx(lang, "Kết thúc buổi học này và lưu thời gian đã học", "End this session and save the study time")}>
              <Icon name="check" size={13} /> {tx(lang, "Hoàn thành & lưu buổi học", "Finish & save session")}
            </button>
          </div>
        ) : null}
        {notice ? <p style={{ color: "var(--good)" }}>{notice}</p> : null}
      </div>

      <div className="grid gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-display text-sm font-bold">{tx(lang, "Buổi học đã lưu", "Saved sessions")}</h3>
          <div className="ml-auto flex items-center gap-1.5">
            <input type="date" className="input" style={{ width: 138 }} value={dateSearch} onChange={(e) => { setDateSearch(e.target.value); setPageIdx(0); }} aria-label={tx(lang, "Tìm theo ngày", "Search by date")} />
            {dateSearch ? (
              <button type="button" className="btn btn-sm" onClick={() => setDateSearch("")}>{tx(lang, "Xóa lọc", "Clear")}</button>
            ) : null}
            <button type="button" className="btn btn-sm" onClick={exportCsv} disabled={sessions.length === 0}>
              <Icon name="download" size={12} /> {tx(lang, "Xuất CSV cho Google Sheet", "CSV for Google Sheet")}
            </button>
          </div>
        </div>
        <div className="grid gap-1.5">
          {filtered.map((s) => (
            <div key={s.id} className="card flex items-center gap-2 px-2.5 py-1.5">
              <div className="min-w-0 flex-1">
                {editingId === s.id ? (
                  <input maxLength={120} required className="input" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} aria-label={tx(lang, "Tiêu đề buổi học", "Session title")} />
                ) : (
                  <p className="truncate text-sm font-bold">{s.title}</p>
                )}
                <p style={{ color: "var(--dim)" }}>
                  {s.minutes} {t(lang, "minutes")} · {fmtDate(s.completedAt, lang)} · {new Date(s.completedAt).toLocaleTimeString(localeOf(lang), { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
              {editingId === s.id ? (
                <>
                  <button type="button" className="btn btn-sm btn-orange" onClick={() => updateSession.mutate({ id: s.id, title: editTitle.trim() || s.title })}>{t(lang, "save")}</button>
                  <button type="button" className="btn btn-sm btn-ghost" onClick={() => setEditingId(null)}>{t(lang, "cancel")}</button>
                </>
              ) : (
                <>
                  <button type="button" className="btn btn-sm" onClick={() => { setEditingId(s.id); setEditTitle(s.title); }} aria-label={t(lang, "edit")}><Icon name="edit" size={12} /></button>
                  <button type="button" className="btn btn-sm btn-danger" onClick={() => setConfirmDelete(s.id)} aria-label={t(lang, "delete")}><Icon name="trash" size={12} /></button>
                </>
              )}
            </div>
          ))}
          {filtered.length === 0 && !sessionsQ.isPending ? (
            <p style={{ color: "var(--dim)" }}>{dateSearch ? (tx(lang, "Không có buổi học nào vào ngày này.", "No sessions on this date.")) : (tx(lang, "Chưa có buổi học nào được lưu.", "No saved sessions yet."))}</p>
          ) : null}
        </div>
        <Pager lang={lang} index={safeIdx} total={filtered.length} onPrev={() => setPageIdx(Math.max(0, safeIdx - 1))} onNext={() => setPageIdx(Math.min(filtered.length - 1, safeIdx + 1))} />
      </div>

      {confirmDelete !== null ? (
        <ConfirmDialog lang={lang} message={tx(lang, "Xóa buổi học này?", "Delete this session?")} confirmLabel={t(lang, "delete")} onConfirm={() => deleteSession.mutate(confirmDelete)} onCancel={() => setConfirmDelete(null)} />
      ) : null}
    </div>
  );
}

// ================================================================ Goals
export function goalStatus(g: GoalItem, lang: Lang): { label: string; done: boolean; overdue: boolean; pct: number } {
  const L = lang === "vi";
  const pct = Math.min(100, Math.round((g.progress / Math.max(1, g.target)) * 100));
  const done = g.progress >= g.target;
  const overdue = !done && g.deadline !== null && g.deadline < new Date().toISOString().slice(0, 10);
  return {
    pct,
    done,
    overdue,
    label: done ? (tx(lang, "Đã hoàn thành", "Completed")) : overdue ? (tx(lang, "Quá hạn", "Overdue")) : (tx(lang, "Đang thực hiện", "In progress")),
  };
}

export function goalTitle(g: GoalItem, lang: Lang): string {
  const L = lang === "vi";
  if (g.type === "minutes") return txf(lang, "Học {0} phút", "Study {0} minutes", g.target);
  if (g.type === "words") return txf(lang, "Học {0} từ vựng", "Learn {0} words", g.target);
  return txf(lang, "Hoàn thành {0} buổi học", "Complete {0} sessions", g.target);
}

export function GoalsView({ token, lang }: { token: string; lang: Lang }) {
  const L = lang === "vi";
  const queryClient = useQueryClient();
  const goalsQ = useQuery({ queryKey: ["goals"], queryFn: () => api.listGoals({ token }) });
  const [type, setType] = useState<"minutes" | "words" | "sessions">("minutes");
  const [target, setTarget] = useState(300);
  const [deadline, setDeadline] = useState("");
  const [editing, setEditing] = useState<GoalItem | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<GoalItem | null>(null);
  const [pageIdx, setPageIdx] = useState(0);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["goals"] });
  const addGoal = useMutation({
    mutationFn: () => api.addGoal({ token, type, target, deadline: deadline || null }),
    // Once the server confirms, the create form resets to its defaults.
    onSuccess: () => { invalidate(); setType("minutes"); setTarget(300); setDeadline(""); },
  });
  const updateGoal = useMutation({
    mutationFn: (args: { id: number; target: number; deadline: string | null }) =>
      api.updateGoal({ token, goalId: args.id, target: args.target, deadline: args.deadline }),
    onSuccess: () => { invalidate(); setEditing(null); },
  });
  const deleteGoal = useMutation({
    mutationFn: (id: number) => api.deleteGoal({ token, goalId: id }),
    onSuccess: () => { invalidate(); setConfirmDelete(null); },
  });

  const goals = goalsQ.data?.goals ?? [];
  const safeIdx = Math.min(pageIdx, Math.max(0, goals.length - 1));

  const submitNew = (e: FormEvent) => {
    e.preventDefault();
    addGoal.mutate();
  };

  return (
    <div className="grid gap-3">
      <form onSubmit={submitNew} className="card grid gap-2 p-2.5">
        <div className="grid grid-cols-3 gap-2">
          <label className="block">
            <span style={{ color: "var(--dim)" }}>{tx(lang, "Loại mục tiêu", "Goal type")}</span>
            <select className="input" value={type} onChange={(e) => setType(e.target.value as typeof type)} aria-label={tx(lang, "Loại mục tiêu", "Goal type")}>
              <option value="minutes">{tx(lang, "Số phút học", "Study minutes")}</option>
              <option value="words">{tx(lang, "Số từ vựng", "Words")}</option>
              <option value="sessions">{tx(lang, "Số buổi học", "Sessions")}</option>
            </select>
          </label>
          <label className="block">
            <span style={{ color: "var(--dim)" }}>{tx(lang, "Chỉ tiêu", "Target")}</span>
            <input min={1} max={1000000} type="number" className="input" value={target} onChange={(e) => setTarget(Number(e.target.value))} />
          </label>
          <label className="block">
            <span style={{ color: "var(--dim)" }}>{tx(lang, "Hạn hoàn thành", "Deadline")}</span>
            <input type="date" className="input" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
          </label>
        </div>
        <div>
          <button type="submit" className="btn btn-orange" disabled={addGoal.isPending} title={tx(lang, "Tạo mục tiêu học mới với loại, chỉ tiêu và hạn hoàn thành ở trên", "Create a new learning goal from the type, target and deadline above")}>
            <Icon name="plus" size={13} /> {tx(lang, "Tạo mục tiêu", "Create goal")}
          </button>
        </div>
      </form>

      <div className="grid gap-1.5">
        {goals.map((g) => {
          const st = goalStatus(g, lang);
          const daysLeft = g.deadline
            ? Math.ceil((new Date(`${g.deadline}T00:00:00`).getTime() - Date.now()) / 86_400_000)
            : null;
          return (
            <div key={g.id} className="card grid gap-1.5 px-2.5 py-2">
              <div className="flex items-center gap-2">
                <span className="flex-1 text-sm font-bold">{goalTitle(g, lang)}</span>
                <span className={`chip ${st.done ? "chip-orange" : st.overdue ? "" : "chip-violet"}`} style={st.overdue ? { color: "var(--bad)" } : undefined}>
                  {st.label}
                </span>
                <span className="font-bold">{st.pct}%</span>
              </div>
              <div className="progress-track"><div className="progress-fill" style={{ width: `${st.pct}%` }} /></div>
              <div className="flex flex-wrap items-center gap-2" style={{ color: "var(--dim)" }}>
                <span>{g.progress}/{g.target} {g.type === "minutes" ? t(lang, "minutes") : g.type === "words" ? t(lang, "words") : (tx(lang, "buổi", "sessions"))}</span>
                {g.deadline ? (
                  <span>· {tx(lang, "Hạn", "Due")} {fmtDate(`${g.deadline}T00:00:00`, lang)}{daysLeft !== null && !st.done ? ` · ${daysLeft >= 0 ? txf(lang, "còn {0} ngày", "{0} days left", daysLeft) : txf(lang, "quá {0} ngày", "{0} days over", -daysLeft)}` : ""}</span>
                ) : null}
                <span className="ml-auto flex gap-1.5">
                  <button type="button" className="btn btn-sm" onClick={() => setEditing(g)}><Icon name="edit" size={12} /> {t(lang, "edit")}</button>
                  <button type="button" className="btn btn-sm btn-danger" onClick={() => setConfirmDelete(g)}><Icon name="trash" size={12} /> {t(lang, "delete")}</button>
                </span>
              </div>
              {editing?.id === g.id ? (
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <label className="block">
                    <span style={{ color: "var(--dim)" }}>{tx(lang, "Chỉ tiêu", "Target")}</span>
                    <input min={1} max={1000000} type="number" className="input" defaultValue={g.target} id={`goal-target-${g.id}`} />
                  </label>
                  <label className="block">
                    <span style={{ color: "var(--dim)" }}>{tx(lang, "Hạn hoàn thành", "Deadline")}</span>
                    <input type="date" className="input" defaultValue={g.deadline ?? ""} id={`goal-deadline-${g.id}`} />
                  </label>
                  <div className="col-span-2 flex gap-1.5">
                    <button
                      type="button"
                      className="btn btn-sm btn-orange"
                      onClick={() => {
                        const tEl = document.getElementById(`goal-target-${g.id}`) as HTMLInputElement | null;
                        const dEl = document.getElementById(`goal-deadline-${g.id}`) as HTMLInputElement | null;
                        updateGoal.mutate({ id: g.id, target: Number(tEl?.value ?? g.target), deadline: dEl?.value ? dEl.value : null });
                      }}
                    >
                      {t(lang, "save")}
                    </button>
                    <button type="button" className="btn btn-sm btn-ghost" onClick={() => setEditing(null)}>{t(lang, "cancel")}</button>
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
        {goals.length === 0 && !goalsQ.isPending ? (
          <p style={{ color: "var(--dim)" }}>{tx(lang, "Chưa có mục tiêu nào. Tạo mục tiêu đầu tiên của bạn nhé.", "No goals yet. Create your first goal.")}</p>
        ) : null}
      </div>
      <Pager lang={lang} index={safeIdx} total={goals.length} onPrev={() => setPageIdx(Math.max(0, safeIdx - 1))} onNext={() => setPageIdx(Math.min(goals.length - 1, safeIdx + 1))} />
      {confirmDelete ? (
        <ConfirmDialog lang={lang} message={txf(lang, "Xóa mục tiêu “{0}”?", "Delete goal “{0}”?", goalTitle(confirmDelete, lang))} confirmLabel={t(lang, "delete")} onConfirm={() => deleteGoal.mutate(confirmDelete.id)} onCancel={() => setConfirmDelete(null)} />
      ) : null}
    </div>
  );
}
