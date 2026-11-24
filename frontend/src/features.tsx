import { useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";
import {
Icon,
dayKey,
fmtDate,
fmtDateTime,
isDue,
speak,
t,
todayKey,
type Lang,
type WordItem,
} from "./lib";
import { localeOf } from "./lib";
import { WEEKDAYS, tx, txf } from "./i18n";
import { ConfirmDialog, Pager, WordDetail, WordForm, emptyWordDraft, type WordDraft } from "./shared";
import { goalTitle } from "./timer";

function useWords(token: string, spaceId: number) {
  return useQuery({
    queryKey: ["words", spaceId],
    queryFn: () => api.listWords({ token, spaceId }),
  });
}

function SectionTitle({ children }: { children: string }) {
  return <h3 className="font-display text-sm font-bold">{children}</h3>;
}

// ================================================================ Vocab
export function VocabView({ token, lang, spaceId }: { token: string; lang: Lang; spaceId: number }) {
  const L = lang === "vi";
  const queryClient = useQueryClient();
  const wordsQ = useWords(token, spaceId);
  const [search, setSearch] = useState("");
  const [openId, setOpenId] = useState<number | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<WordItem | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<WordItem | null>(null);
  const [pageIdx, setPageIdx] = useState(0);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["words", spaceId] });
  const addWord = useMutation({
    mutationFn: (d: WordDraft) => api.addWord({ token, spaceId, ...d }),
    onSuccess: () => { invalidate(); setFormOpen(false); },
  });
  const updateWord = useMutation({
    mutationFn: (args: { id: number; d: WordDraft }) =>
      api.updateWord({ token, wordId: args.id, ...args.d }),
    onSuccess: () => { invalidate(); setEditing(null); },
  });
  const deleteWord = useMutation({
    mutationFn: (id: number) => api.deleteWord({ token, wordId: id }),
    onSuccess: () => { invalidate(); setConfirmDelete(null); },
  });
  const toggleCard = useMutation({
    mutationFn: (args: { id: number; on: boolean }) =>
      api.setWordFlashcard({ token, wordId: args.id, inFlashcards: args.on }),
    onSuccess: invalidate,
  });

  const all = wordsQ.data?.words ?? [];
  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return all;
    return all.filter(
      (w) => w.word.toLowerCase().includes(q) || w.meaning.toLowerCase().includes(q),
    );
  }, [all, search]);
  const safeIdx = Math.min(pageIdx, Math.max(0, shown.length - 1));
  const current = shown[safeIdx];

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <span style={{ color: "var(--dim)" }}>
          {all.length} {t(lang, "words")}
        </span>
        <div className="relative ml-auto w-44">
          <input
            className="input pr-7"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPageIdx(0); }}
            placeholder={tx(lang, "Tìm từ…", "Search words…")}
            aria-label={t(lang, "search")}
          />
          <span className="absolute right-2 top-1/2 -translate-y-1/2" style={{ color: "var(--dim)" }}>
            <Icon name="search" size={13} />
          </span>
        </div>
      </div>

      <div className="card">
        <button
          type="button"
          className="flex w-full items-center justify-between p-2.5 font-semibold"
          onClick={() => setFormOpen((v) => !v)}
          aria-expanded={formOpen}
          title={tx(lang, "Mở form thêm từ vựng mới vào sổ tay", "Open the form to add a new word")}
        >
          <span className="inline-flex items-center gap-1.5"><Icon name="plus" size={13} /> {tx(lang, "Thêm từ mới", "Add a new word")}</span>
          <Icon name={formOpen ? "chevD" : "chevR"} size={13} />
        </button>
        {formOpen ? (
          <div className="px-2.5 pb-2.5">
            <WordForm lang={lang} initial={emptyWordDraft} submitLabel={tx(lang, "Lưu từ", "Save word")} pending={addWord.isPending} onSubmit={(d) => addWord.mutate(d)} />
          </div>
        ) : null}
      </div>

      {wordsQ.isPending ? <p style={{ color: "var(--dim)" }}>{tx(lang, "Đang tải…", "Loading…")}</p> : null}
      {shown.length === 0 && !wordsQ.isPending ? (
        <p style={{ color: "var(--dim)" }}>{tx(lang, "Chưa có từ nào. Thêm từ đầu tiên của bạn nhé.", "No words yet. Add your first word.")}</p>
      ) : null}

      <div className="grid gap-1.5">
        {shown.map((w) => {
          const open = openId === w.id;
          return (
            <div key={w.id} className="card px-2.5 py-1.5">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  onClick={() => setOpenId(open ? null : w.id)}
                  aria-expanded={open}
                >
                  <span className="truncate text-sm font-bold">{w.word}</span>
                  {w.meaning ? <span className="truncate" style={{ color: "var(--dim)" }}>{w.meaning}</span> : null}
                </button>
                <span style={{ color: "var(--dim)" }}>{fmtDateTime(w.createdAt, lang)}</span>
                <Icon name={open ? "chevD" : "chevR"} size={13} />
              </div>
              {open ? (
                <div className="pt-1.5">
                  <WordDetail lang={lang} word={w} />
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    <button
                      type="button"
                      className={w.inFlashcards ? "btn btn-sm" : "btn btn-sm btn-orange"}
                      onClick={() => toggleCard.mutate({ id: w.id, on: !w.inFlashcards })}
                    >
                      {w.inFlashcards ? (tx(lang, "Đã thêm vào Flashcards ✓", "In Flashcards ✓")) : (tx(lang, "Thêm vào Flashcards", "Add to Flashcards"))}
                    </button>
                    <button type="button" className="btn btn-sm" onClick={() => setEditing(w)}>
                      <Icon name="edit" size={12} /> {t(lang, "edit")}
                    </button>
                    <button type="button" className="btn btn-sm btn-danger" onClick={() => setConfirmDelete(w)}>
                      <Icon name="trash" size={12} /> {t(lang, "delete")}
                    </button>
                  </div>
                  {editing?.id === w.id ? (
                    <div className="pt-2">
                      <WordForm
                        lang={lang}
                        initial={{ word: w.word, meaning: w.meaning, ipaUk: w.ipaUk, ipaUs: w.ipaUs, example: w.example }}
                        submitLabel={t(lang, "save")}
                        pending={updateWord.isPending}
                        onSubmit={(d) => updateWord.mutate({ id: w.id, d })}
                      />
                      <button type="button" className="btn btn-sm btn-ghost mt-1" onClick={() => setEditing(null)}>{t(lang, "cancel")}</button>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {current ? (
        <p className="text-center" style={{ color: "var(--dim)" }}>
          {tx(lang, "Từ đang xem:", "Viewing:")} <b style={{ color: "var(--text)" }}>{current.word}</b>
        </p>
      ) : null}
      <Pager lang={lang} index={safeIdx} total={shown.length} onPrev={() => { setPageIdx(Math.max(0, safeIdx - 1)); setOpenId(shown[safeIdx - 1]?.id ?? null); }} onNext={() => { setPageIdx(Math.min(shown.length - 1, safeIdx + 1)); setOpenId(shown[safeIdx + 1]?.id ?? null); }} />

      {confirmDelete ? (
        <ConfirmDialog
          lang={lang}
          message={txf(lang, "Xóa từ “{0}”?", "Delete “{0}”?", confirmDelete.word)}
          confirmLabel={t(lang, "delete")}
          onConfirm={() => deleteWord.mutate(confirmDelete.id)}
          onCancel={() => setConfirmDelete(null)}
        />
      ) : null}
    </div>
  );
}

// ================================================================ Flashcards
export function FlashcardsView({ token, lang, spaceId }: { token: string; lang: Lang; spaceId: number }) {
  const L = lang === "vi";
  const queryClient = useQueryClient();
  const wordsQ = useWords(token, spaceId);
  const [flipped, setFlipped] = useState(false);
  const [cardIdx, setCardIdx] = useState(0);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<WordItem | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<WordItem | null>(null);
  const [openSection, setOpenSection] = useState<string>("due");
  const [openWordId, setOpenWordId] = useState<number | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["words", spaceId] });
  const review = useMutation({
    mutationFn: (args: { id: number; remembered: boolean }) =>
      api.reviewFlashcard({ token, wordId: args.id, remembered: args.remembered }),
    onSuccess: () => { invalidate(); setFlipped(false); },
  });
  const addWord = useMutation({
    mutationFn: async (d: WordDraft) => {
      const r = await api.addWord({ token, spaceId, ...d });
      await api.setWordFlashcard({ token, wordId: r.id, inFlashcards: true });
      return r;
    },
    onSuccess: () => { invalidate(); setFormOpen(false); },
  });
  const updateWord = useMutation({
    mutationFn: (args: { id: number; d: WordDraft }) => api.updateWord({ token, wordId: args.id, ...args.d }),
    onSuccess: () => { invalidate(); setEditing(null); },
  });
  const deleteWord = useMutation({
    mutationFn: (id: number) => api.deleteWord({ token, wordId: id }),
    onSuccess: () => { invalidate(); setConfirmDelete(null); },
  });

  const deck = (wordsQ.data?.words ?? []).filter((w) => w.inFlashcards);
  const due = deck.filter((w) => isDue(w.nextReviewAt));
  const safeIdx = Math.min(cardIdx, Math.max(0, due.length - 1));
  const card = due[safeIdx];

  const renderManageRow = (w: WordItem, extra?: string) => {
    const open = openWordId === w.id;
    return (
      <div key={w.id} className="card px-2.5 py-1.5">
        <button type="button" className="flex w-full items-center gap-2 text-left" onClick={() => setOpenWordId(open ? null : w.id)} aria-expanded={open}>
          <span className="flex-1 truncate text-sm font-bold">{w.word}</span>
          {extra ? <span style={{ color: "var(--dim)" }}>{extra}</span> : null}
          <Icon name={open ? "chevD" : "chevR"} size={13} />
        </button>
        {open ? (
          <div className="pt-1.5">
            <WordDetail lang={lang} word={w} />
            <p style={{ color: "var(--dim)" }}>
              {tx(lang, "Đã lưu:", "Saved:")} {fmtDateTime(w.createdAt, lang)}
              {w.nextReviewAt ? <> · {tx(lang, "Ôn lại:", "Review:")} {fmtDate(w.nextReviewAt, lang)}</> : null}
            </p>
            <div className="flex gap-1.5 pt-1">
              <button type="button" className="btn btn-sm" onClick={() => setEditing(w)}><Icon name="edit" size={12} /> {t(lang, "edit")}</button>
              <button type="button" className="btn btn-sm btn-danger" onClick={() => setConfirmDelete(w)}><Icon name="trash" size={12} /> {t(lang, "delete")}</button>
            </div>
            {editing?.id === w.id ? (
              <div className="pt-2">
                <WordForm lang={lang} initial={{ word: w.word, meaning: w.meaning, ipaUk: w.ipaUk, ipaUs: w.ipaUs, example: w.example }} submitLabel={t(lang, "save")} pending={updateWord.isPending} onSubmit={(d) => updateWord.mutate({ id: w.id, d })} />
                <button type="button" className="btn btn-sm btn-ghost mt-1" onClick={() => setEditing(null)}>{t(lang, "cancel")}</button>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  };

  const section = (id: string, title: string, rows: WordItem[], extraFn?: (w: WordItem) => string) => (
    <div className="grid gap-1.5">
      <button type="button" className="flex items-center justify-between" onClick={() => setOpenSection(openSection === id ? "" : id)} aria-expanded={openSection === id}>
        <SectionTitle>{`${title} (${rows.length})`}</SectionTitle>
        <Icon name={openSection === id ? "chevD" : "chevR"} size={13} />
      </button>
      {openSection === id ? (
        rows.length ? rows.map((w) => renderManageRow(w, extraFn?.(w))) : (
          <p style={{ color: "var(--dim)" }}>{tx(lang, "Chưa có từ nào.", "No words yet.")}</p>
        )
      ) : null}
    </div>
  );

  return (
    <div className="grid gap-4">
      {card ? (
        <div className="grid gap-2">
          <div
            key={`${card.id}-${flipped ? "b" : "f"}`}
            className="card flip-anim flex min-h-44 cursor-pointer flex-col items-center justify-center gap-2 p-4 text-center"
            onClick={() => setFlipped((v) => !v)}
            role="button"
            aria-label={tx(lang, "Lật thẻ", "Flip card")}
          >
            {!flipped ? (
              <>
                <span className="font-display text-3xl font-extrabold">{card.word}</span>
                <span style={{ color: "var(--dim)" }}>{tx(lang, "Chạm để lật thẻ", "Tap to flip")}</span>
              </>
            ) : (
              <>
                <span className="text-sm font-bold">{card.meaning || "—"}</span>
                {card.ipaUk ? <span style={{ color: "var(--dim)" }}>IPA 1: {card.ipaUk}</span> : null}
                {card.ipaUs ? <span style={{ color: "var(--dim)" }}>IPA 2: {card.ipaUs}</span> : null}
                {card.example ? <em style={{ color: "var(--dim)" }}>“{card.example}”</em> : null}
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={(e) => { e.stopPropagation(); speak(card.word); }}
                  aria-label={tx(lang, "Nghe phát âm", "Listen")}
                >
                  <Icon name="volume" size={13} /> {tx(lang, "Nghe", "Listen")}
                </button>
              </>
            )}
          </div>
          <div className="flex justify-center gap-2">
            <button type="button" className="btn" onClick={() => review.mutate({ id: card.id, remembered: false })} disabled={review.isPending} title={tx(lang, "Chưa thuộc từ này — hệ thống sẽ nhắc bạn ôn lại vào ngày mai", "You don't know this word yet — it comes back tomorrow")}>
              {tx(lang, "Chưa nhớ · ôn ngày mai", "Not yet · tomorrow")}
            </button>
            <button type="button" className="btn btn-orange" onClick={() => review.mutate({ id: card.id, remembered: true })} disabled={review.isPending} title={tx(lang, "Đã thuộc từ này — hệ thống sẽ nhắc ôn lại sau 3 ngày", "You know this word — it comes back in 3 days")}>
              <Icon name="check" size={13} /> {tx(lang, "Nhớ rồi · 3 ngày nữa", "Got it · in 3 days")}
            </button>
          </div>
          <Pager lang={lang} index={safeIdx} total={due.length} onPrev={() => { setCardIdx(Math.max(0, safeIdx - 1)); setFlipped(false); }} onNext={() => { setCardIdx(Math.min(due.length - 1, safeIdx + 1)); setFlipped(false); }} />
        </div>
      ) : (
        <p className="card p-3 text-center" style={{ color: "var(--dim)" }}>
          {deck.length === 0
            ? (tx(lang, "Chưa có thẻ nào. Thêm từ mới ở dưới hoặc thêm từ Sổ tay từ vựng.", "No cards yet. Add a word below or from the Vocabulary notebook."))
            : (tx(lang, "Hôm nay không còn từ cần ôn. Làm tốt lắm!", "Nothing due today. Great job!"))}
        </p>
      )}

      <div className="card">
        <button type="button" className="flex w-full items-center justify-between p-2.5 font-semibold" onClick={() => setFormOpen((v) => !v)} aria-expanded={formOpen} title={tx(lang, "Mở form thêm từ mới vào bộ Flashcards", "Open the form to add a new flashcard word")}>
          <span className="inline-flex items-center gap-1.5"><Icon name="plus" size={13} /> {tx(lang, "Thêm từ mới", "Add a new word")}</span>
          <Icon name={formOpen ? "chevD" : "chevR"} size={13} />
        </button>
        {formOpen ? (
          <div className="px-2.5 pb-2.5">
            <WordForm lang={lang} initial={emptyWordDraft} submitLabel={tx(lang, "Lưu từ", "Save word")} pending={addWord.isPending} onSubmit={(d) => addWord.mutate(d)} />
          </div>
        ) : null}
      </div>

      {section("due", tx(lang, "Từ cần ôn hôm nay", "Due today"), due)}
      {section("schedule", tx(lang, "Lịch hẹn ôn lại", "Review schedule"), deck.filter((w) => !isDue(w.nextReviewAt)), (w) => (w.nextReviewAt ? fmtDate(w.nextReviewAt, lang) : ""))}
      {section("manage", tx(lang, "Quản lý từ", "Manage words"), deck)}

      {confirmDelete ? (
        <ConfirmDialog lang={lang} message={txf(lang, "Xóa từ “{0}”?", "Delete “{0}”?", confirmDelete.word)} confirmLabel={t(lang, "delete")} onConfirm={() => deleteWord.mutate(confirmDelete.id)} onCancel={() => setConfirmDelete(null)} />
      ) : null}
    </div>
  );
}

// ================================================================ Notes
export function NotesView({ token, lang, spaceId }: { token: string; lang: Lang; spaceId: number }) {
  const L = lang === "vi";
  const queryClient = useQueryClient();
  const notesQ = useQuery({ queryKey: ["notes", spaceId], queryFn: () => api.listNotes({ token, spaceId }) });
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [titleError, setTitleError] = useState("");
  const [openId, setOpenId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [pageIdx, setPageIdx] = useState(0);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["notes", spaceId] });
  const addNote = useMutation({
    mutationFn: () => api.addNote({ token, spaceId, title: title.trim(), content: content.trim() }),
    onSuccess: () => { invalidate(); setTitle(""); setContent(""); },
  });
  const updateNote = useMutation({
    mutationFn: (args: { id: number; title: string; content: string }) =>
      api.updateNote({ token, noteId: args.id, title: args.title, content: args.content }),
    onSuccess: () => { invalidate(); setEditingId(null); },
  });
  const deleteNote = useMutation({
    mutationFn: (id: number) => api.deleteNote({ token, noteId: id }),
    onSuccess: () => { invalidate(); setConfirmDelete(null); },
  });

  const notes = notesQ.data?.notes ?? [];
  const safeIdx = Math.min(pageIdx, Math.max(0, notes.length - 1));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setTitleError(tx(lang, "Hãy nhập tiêu đề ghi nhớ nhé.", "Give your note a title."));
      return;
    }
    setTitleError("");
    addNote.mutate();
  };

  return (
    <div className="grid gap-3">
      <form onSubmit={submit} className="card grid gap-2 p-2.5">
        <label className="block">
          <span style={{ color: "var(--dim)" }}>{tx(lang, "Tiêu đề", "Title")}</span>
          <input maxLength={120} required className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={tx(lang, "Ví dụ: Thì hiện tại đơn", "e.g. Present simple")} />
        </label>
        {titleError ? <p style={{ color: "var(--bad)" }}>{titleError}</p> : null}
        <label className="block">
          <span style={{ color: "var(--dim)" }}>{tx(lang, "Nội dung", "Content")}</span>
          <textarea maxLength={4000} className="input" rows={3} value={content} onChange={(e) => setContent(e.target.value)} placeholder={tx(lang, "Ghi ngắn gọn, dễ hiểu…", "Keep it short and clear…")} />
        </label>
        <div>
          <button type="submit" className="btn btn-orange" disabled={addNote.isPending}>
            <Icon name="plus" size={13} /> {tx(lang, "Lưu ghi nhớ", "Save note")}
          </button>
        </div>
      </form>

      <div className="grid gap-1.5">
        {notes.map((n) => {
          const open = openId === n.id;
          const editing = editingId === n.id;
          return (
            <div key={n.id} className="card px-2.5 py-1.5">
              <button type="button" className="flex w-full items-center gap-2 text-left" onClick={() => setOpenId(open ? null : n.id)} aria-expanded={open}>
                <span className="flex-1 truncate text-sm font-bold">{n.title}</span>
                <span style={{ color: "var(--dim)" }}>{fmtDate(n.updatedAt, lang)}</span>
                <Icon name={open ? "chevD" : "chevR"} size={13} />
              </button>
              {open && !editing ? (
                <div className="pt-1.5">
                  <p className="whitespace-pre-wrap" style={{ color: "var(--dim)" }}>{n.content || "—"}</p>
                  <div className="flex gap-1.5 pt-1.5">
                    <button type="button" className="btn btn-sm" onClick={() => { setEditingId(n.id); setTitle(n.title); setContent(n.content); }}>
                      <Icon name="edit" size={12} /> {t(lang, "edit")}
                    </button>
                    <button type="button" className="btn btn-sm btn-danger" onClick={() => setConfirmDelete(n.id)}>
                      <Icon name="trash" size={12} /> {t(lang, "delete")}
                    </button>
                  </div>
                </div>
              ) : null}
              {open && editing ? (
                <div className="grid gap-2 pt-1.5">
                  <input maxLength={120} required className="input" value={title} onChange={(e) => setTitle(e.target.value)} aria-label={tx(lang, "Tiêu đề", "Title")} />
                  <textarea maxLength={4000} className="input" rows={3} value={content} onChange={(e) => setContent(e.target.value)} aria-label={tx(lang, "Nội dung", "Content")} />
                  <div className="flex gap-1.5">
                    <button type="button" className="btn btn-sm btn-orange" onClick={() => updateNote.mutate({ id: n.id, title: title.trim(), content: content.trim() })} disabled={updateNote.isPending}>{t(lang, "save")}</button>
                    <button type="button" className="btn btn-sm btn-ghost" onClick={() => setEditingId(null)}>{t(lang, "cancel")}</button>
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
        {notes.length === 0 && !notesQ.isPending ? (
          <p style={{ color: "var(--dim)" }}>{tx(lang, "Chưa có ghi nhớ nào.", "No notes yet.")}</p>
        ) : null}
      </div>
      <Pager lang={lang} index={safeIdx} total={notes.length} onPrev={() => { const i = Math.max(0, safeIdx - 1); setPageIdx(i); setOpenId(notes[i]?.id ?? null); }} onNext={() => { const i = Math.min(notes.length - 1, safeIdx + 1); setPageIdx(i); setOpenId(notes[i]?.id ?? null); }} />
      {confirmDelete !== null ? (
        <ConfirmDialog lang={lang} message={tx(lang, "Xóa ghi nhớ này?", "Delete this note?")} confirmLabel={t(lang, "delete")} onConfirm={() => deleteNote.mutate(confirmDelete)} onCancel={() => setConfirmDelete(null)} />
      ) : null}
    </div>
  );
}

// ================================================================ Quiz
const QUIZ: { q: string; options: string[]; answer: number; explain: { vi: string; en: string } & Partial<Record<Lang, string>> }[] = [
  { q: "She ___ to school every day.", options: ["go", "goes", "going", "gone"], answer: 1, explain: { vi: "Chủ ngữ số ít (she) → động từ thêm -es: goes.", en: "Singular subject (she) → goes." } },
  { q: "I ___ a student.", options: ["is", "are", "am", "be"], answer: 2, explain: { vi: "Với “I” ta dùng “am”.", en: "With “I” we use “am”." } },
  { q: "They ___ football yesterday.", options: ["play", "plays", "played", "playing"], answer: 2, explain: { vi: "“Yesterday” là quá khứ → played.", en: "“Yesterday” signals the past → played." } },
  { q: "This book is ___ than that one.", options: ["interesting", "more interesting", "most interesting", "interestinger"], answer: 1, explain: { vi: "So sánh hơn với tính từ dài dùng “more + adj”.", en: "Comparatives with long adjectives use “more + adj”." } },
  { q: "___ you like some coffee?", options: ["Would", "Will", "Do", "Are"], answer: 0, explain: { vi: "Mời mọc lịch sự: “Would you like…?”", en: "A polite offer: “Would you like…?”" } },
  { q: "He has lived here ___ 2020.", options: ["for", "since", "from", "at"], answer: 1, explain: { vi: "“Since” + mốc thời gian (2020).", en: "“Since” + a point in time (2020)." } },
  { q: "There ___ some milk in the fridge.", options: ["are", "is", "be", "were"], answer: 1, explain: { vi: "“Milk” không đếm được → “is”.", en: "“Milk” is uncountable → “is”." } },
  { q: "If it rains, we ___ at home.", options: ["stay", "will stay", "stayed", "stays"], answer: 1, explain: { vi: "Câu điều kiện loại 1: will + động từ.", en: "First conditional: will + verb." } },
];

export function QuizView({ lang }: { lang: Lang }) {
  const L = lang === "vi";
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const item = QUIZ[idx];
  if (!item) return null;
  const chosen = answers[idx];
  const score = QUIZ.reduce((s, q, i) => (answers[i] === q.answer ? s + 1 : s), 0);
  const done = Object.keys(answers).length;

  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between">
        <SectionTitle>{tx(lang, "Quiz nhanh", "Quick quiz")}</SectionTitle>
        <span className="chip chip-orange">{tx(lang, "Điểm", "Score")}: {score}/{QUIZ.length}</span>
      </div>
      <div className="card grid gap-2 p-3">
        <p className="text-sm font-bold">{item.q}</p>
        <div className="grid gap-1.5">
          {item.options.map((opt, i) => {
            const isAnswer = i === item.answer;
            const isChosen = chosen === i;
            const revealed = chosen !== undefined;
            return (
              <button
                key={opt}
                type="button"
                className="btn justify-start"
                style={{
                  minHeight: 32,
                  ...(revealed && isAnswer ? { borderColor: "var(--good)", color: "var(--good)" } : {}),
                  ...(revealed && isChosen && !isAnswer ? { borderColor: "var(--bad)", color: "var(--bad)" } : {}),
                }}
                onClick={() => setAnswers((a) => ({ ...a, [idx]: i }))}
              >
                {opt}
                {revealed && isAnswer ? <Icon name="check" size={13} /> : null}
                {revealed && isChosen && !isAnswer ? <Icon name="x" size={13} /> : null}
              </button>
            );
          })}
        </div>
        {chosen !== undefined ? (
          <p style={{ color: chosen === item.answer ? "var(--good)" : "var(--bad)" }}>
            {chosen === item.answer ? (tx(lang, "Đúng rồi! ", "Correct! ")) : (tx(lang, "Chưa đúng. ", "Not quite. "))}
            <span style={{ color: "var(--dim)" }}>{item.explain[lang] ?? item.explain.en}</span>
          </p>
        ) : null}
        {done === QUIZ.length ? (
          <p className="font-semibold">{txf(lang, "Hoàn thành! Bạn đúng {0}/{1} câu.", "Done! You scored {0}/{1}.", score, QUIZ.length)}</p>
        ) : null}
      </div>
      <Pager lang={lang} index={idx} total={QUIZ.length} onPrev={() => setIdx(Math.max(0, idx - 1))} onNext={() => setIdx(Math.min(QUIZ.length - 1, idx + 1))} />
    </div>
  );
}

// ================================================================ Listening
const LISTENING: { sentence: string; options: string[] }[] = [
  { sentence: "Good morning, how are you today?", options: ["Good morning, how are you today?", "Good evening, how are you today?", "Good morning, who are you today?"] },
  { sentence: "I would like a cup of coffee, please.", options: ["I would like a cup of tea, please.", "I would like a cup of coffee, please.", "I would buy a cup of coffee, please."] },
  { sentence: "The train leaves at seven o'clock.", options: ["The train lives at seven o'clock.", "The plane leaves at seven o'clock.", "The train leaves at seven o'clock."] },
  { sentence: "She is reading a book in the garden.", options: ["She is reading a book in the garden.", "She is writing a book in the garden.", "She is reading a book in the kitchen."] },
  { sentence: "Can you help me find this address?", options: ["Can you help me find this address?", "Can you show me this address?", "Can you help me buy this address?"] },
  { sentence: "We are going to the beach this weekend.", options: ["We are going to the beach this weekend.", "We are going to the mountains this weekend.", "We are going to the beach this morning."] },
];

export function ListeningView({ lang }: { lang: Lang }) {
  const L = lang === "vi";
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<Record<number, string>>({});
  const item = LISTENING[idx];
  if (!item) return null;
  const choice = picked[idx];
  const correctCount = LISTENING.reduce((s, it, i) => (picked[i] === it.sentence ? s + 1 : s), 0);

  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between">
        <SectionTitle>{tx(lang, "Luyện nghe", "Listening")}</SectionTitle>
        <span className="chip chip-orange">{tx(lang, "Đúng", "Correct")}: {correctCount}/{LISTENING.length}</span>
      </div>
      <div className="card grid gap-2 p-3">
        <p style={{ color: "var(--dim)" }}>{tx(lang, "Bấm Nghe, rồi chọn đúng câu bạn vừa nghe.", "Tap Listen, then pick the sentence you heard.")}</p>
        <div>
          <button type="button" className="btn btn-primary btn-lg" onClick={() => speak(item.sentence)}>
            <Icon name="volume" size={15} /> {tx(lang, "Nghe câu này", "Listen")}
          </button>
        </div>
        <div className="grid gap-1.5">
          {item.options.map((opt) => {
            const revealed = choice !== undefined;
            const isRight = opt === item.sentence;
            return (
              <button
                key={opt}
                type="button"
                className="btn justify-start"
                style={{
                  minHeight: 32,
                  whiteSpace: "normal",
                  textAlign: "left",
                  ...(revealed && isRight ? { borderColor: "var(--good)", color: "var(--good)" } : {}),
                  ...(revealed && choice === opt && !isRight ? { borderColor: "var(--bad)", color: "var(--bad)" } : {}),
                }}
                onClick={() => setPicked((p) => ({ ...p, [idx]: opt }))}
              >
                {opt}
              </button>
            );
          })}
        </div>
        {choice !== undefined ? (
          <p style={{ color: choice === item.sentence ? "var(--good)" : "var(--bad)" }}>
            {choice === item.sentence ? (tx(lang, "Chính xác!", "Exactly right!")) : (tx(lang, "Chưa đúng, nghe lại nhé.", "Not quite — listen again."))}
          </p>
        ) : null}
      </div>
      <Pager lang={lang} index={idx} total={LISTENING.length} onPrev={() => setIdx(Math.max(0, idx - 1))} onNext={() => setIdx(Math.min(LISTENING.length - 1, idx + 1))} />
    </div>
  );
}

// ================================================================ Calendar
// Google-Calendar-style study calendar for one space: Tháng (month) /
// Tuần (week) / Lịch trình (agenda) views. The user adds their own events
// (title, day, optional start/end time, colour, note) and can edit or
// delete them; study sessions, flashcard words coming due and goal
// deadlines appear automatically alongside.

type CalEventItem = {
  id: number;
  spaceId: number;
  title: string;
  note: string;
  date: string;
  endDate: string;
  startTime: string;
  endTime: string;
  color: string;
};

type EventDraft = {
  title: string;
  date: string;
  endDate: string;
  startTime: string;
  endTime: string;
  color: string;
  note: string;
};

// A wide palette of preset swatches; the colour input next to them lets
// the user pick any custom colour, stored as its hex value.
const EVENT_COLORS: { key: string; hex: string }[] = [
  { key: "violet", hex: "#7c3aed" },
  { key: "blue", hex: "#2f6bff" },
  { key: "sky", hex: "#38bdf8" },
  { key: "teal", hex: "#2dd4bf" },
  { key: "green", hex: "#34d399" },
  { key: "lime", hex: "#a3e635" },
  { key: "yellow", hex: "#facc15" },
  { key: "orange", hex: "#ff8a3d" },
  { key: "red", hex: "#f87171" },
  { key: "pink", hex: "#f472b6" },
  { key: "rose", hex: "#fb7185" },
  { key: "brown", hex: "#b45309" },
  { key: "gray", hex: "#94a3b8" },
];
const colorHex = (key: string): string =>
  key.startsWith("#") ? key : (EVENT_COLORS.find((c) => c.key === key)?.hex ?? "#7c3aed");

function keyOfDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function parseKey(key: string): Date {
  const [y = 1970, m = 1, dd = 1] = key.split("-").map(Number);
  return new Date(y, m - 1, dd);
}
function addDaysToKey(key: string, n: number): string {
  const d = parseKey(key);
  d.setDate(d.getDate() + n);
  return keyOfDate(d);
}
function mondayOfKey(key: string): string {
  const d = parseKey(key);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return keyOfDate(d);
}

export function CalendarView({ token, lang, spaceId }: { token: string; lang: Lang; spaceId: number }) {
  const L = lang === "vi";
  const queryClient = useQueryClient();
  const sessionsQ = useQuery({ queryKey: ["sessions", spaceId], queryFn: () => api.listStudySessions({ token, spaceId }) });
  const wordsQ = useWords(token, spaceId);
  const goalsQ = useQuery({ queryKey: ["goals"], queryFn: () => api.listGoals({ token }) });
  const eventsQ = useQuery({ queryKey: ["cal-events", spaceId], queryFn: () => api.listCalendarEvents({ token, spaceId }) });

  const [mode, setMode] = useState<"month" | "week" | "agenda">("month");
  const [anchor, setAnchor] = useState<string>(todayKey());
  const [selected, setSelected] = useState<string>(todayKey());
  const [draft, setDraft] = useState<EventDraft | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formError, setFormError] = useState("");
  const [confirmDeleteEvent, setConfirmDeleteEvent] = useState<CalEventItem | null>(null);

  const invalidateEvents = () => queryClient.invalidateQueries({ queryKey: ["cal-events", spaceId] });
  const addEvent = useMutation({
    mutationFn: (d: EventDraft) => api.addCalendarEvent({ token, spaceId, ...d }),
    onSuccess: () => { invalidateEvents(); setDraft(null); setEditingId(null); },
    onError: (e) => setFormError(e.message),
  });
  const updateEvent = useMutation({
    mutationFn: (args: { id: number; d: EventDraft }) => api.updateCalendarEvent({ token, eventId: args.id, ...args.d }),
    onSuccess: () => { invalidateEvents(); setDraft(null); setEditingId(null); },
    onError: (e) => setFormError(e.message),
  });
  const deleteEvent = useMutation({
    mutationFn: (id: number) => api.deleteCalendarEvent({ token, eventId: id }),
    onSuccess: () => { invalidateEvents(); setConfirmDeleteEvent(null); },
  });

  const sessions = sessionsQ.data?.sessions ?? [];
  const words = wordsQ.data?.words ?? [];
  const goals = goalsQ.data?.goals ?? [];
  const events = eventsQ.data?.events ?? [];

  type DayBucket = {
    minutes: number;
    sessions: typeof sessions;
    dueWords: WordItem[];
    deadlines: typeof goals;
    events: CalEventItem[];
  };
  const byDay = useMemo(() => {
    const map = new Map<string, DayBucket>();
    const bucket = (key: string): DayBucket => {
      let b = map.get(key);
      if (!b) {
        b = { minutes: 0, sessions: [], dueWords: [], deadlines: [], events: [] };
        map.set(key, b);
      }
      return b;
    };
    // A multi-day event appears on every day from its start to its end.
    for (const e of events) {
      const last = e.endDate && e.endDate > e.date ? e.endDate : e.date;
      let key = e.date;
      for (let guard = 0; guard < 370 && key <= last; guard++) {
        bucket(key).events.push(e);
        key = addDaysToKey(key, 1);
      }
    }
    for (const s of sessions) {
      const b = bucket(dayKey(s.completedAt));
      b.minutes += s.minutes;
      b.sessions.push(s);
    }
    for (const w of words) {
      if (w.inFlashcards && w.nextReviewAt) bucket(dayKey(w.nextReviewAt)).dueWords.push(w);
    }
    for (const g of goals) {
      if (g.deadline) bucket(g.deadline).deadlines.push(g);
    }
    return map;
  }, [events, sessions, words, goals]);

  const anchorDate = parseKey(anchor);
  const weekStart = mondayOfKey(anchor);
  const weekDaysList = Array.from({ length: 7 }, (_, i) => addDaysToKey(weekStart, i));
  const weekDayNames = L
    ? ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "Chủ nhật"]
    : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const weekShort = WEEKDAYS[lang];

  const move = (dir: 1 | -1) => {
    if (mode === "month") {
      const d = new Date(anchorDate.getFullYear(), anchorDate.getMonth() + dir, 1);
      setAnchor(keyOfDate(d));
    } else if (mode === "week") {
      setAnchor(addDaysToKey(anchor, dir * 7));
    } else {
      setAnchor(addDaysToKey(anchor, dir * 30));
    }
  };
  const goToday = () => {
    setAnchor(todayKey());
    setSelected(todayKey());
  };

  const periodLabel =
    mode === "month"
      ? anchorDate.toLocaleDateString(localeOf(lang), { month: "long", year: "numeric" })
      : mode === "week"
        ? `${fmtDate(`${weekStart}T00:00:00`, lang)} – ${fmtDate(`${addDaysToKey(weekStart, 6)}T00:00:00`, lang)}`
        : `${tx(lang, "Từ", "From")} ${fmtDate(`${anchor}T00:00:00`, lang)}`;

  // Month grid (Monday-first), like Google Calendar's month view.
  const monthFirst = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), 1);
  const startOffset = (monthFirst.getDay() + 6) % 7;
  const daysInMonth = new Date(anchorDate.getFullYear(), anchorDate.getMonth() + 1, 0).getDate();
  const monthCells: (number | null)[] = [
    ...Array.from({ length: startOffset }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (monthCells.length % 7 !== 0) monthCells.push(null);
  const monthKeyOf = (d: number) =>
    `${anchorDate.getFullYear()}-${String(anchorDate.getMonth() + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

  const agendaDays = Array.from({ length: 30 }, (_, i) => addDaysToKey(anchor, i)).filter((k) => {
    const b = byDay.get(k);
    return b && (b.events.length > 0 || b.sessions.length > 0 || b.dueWords.length > 0 || b.deadlines.length > 0);
  });

  const openNewEvent = (date: string) => {
    setEditingId(null);
    setFormError("");
    setDraft({ title: "", date, endDate: date, startTime: "", endTime: "", color: "violet", note: "" });
  };
  const openEditEvent = (e: CalEventItem) => {
    setEditingId(e.id);
    setFormError("");
    setDraft({ title: e.title, date: e.date, endDate: e.endDate || e.date, startTime: e.startTime, endTime: e.endTime, color: e.color, note: e.note });
  };
  const saveDraft = () => {
    if (!draft) return;
    if (!draft.title.trim()) {
      setFormError(tx(lang, "Hãy đặt tên cho sự kiện nhé.", "Give the event a title."));
      return;
    }
    if (!draft.date) {
      setFormError(tx(lang, "Hãy chọn ngày cho sự kiện nhé.", "Pick a day for the event."));
      return;
    }
    if (draft.endDate && draft.endDate < draft.date) {
      setFormError(tx(lang, "Ngày kết thúc phải từ ngày bắt đầu trở đi nhé.", "The end date must be on or after the start date."));
      return;
    }
    if (draft.startTime && draft.endTime && draft.endTime < draft.startTime) {
      setFormError(tx(lang, "Giờ kết thúc phải sau giờ bắt đầu nhé.", "The end time must be after the start time."));
      return;
    }
    setFormError("");
    const d = { ...draft, title: draft.title.trim(), note: draft.note.trim(), endDate: draft.endDate || draft.date };
    if (editingId != null) updateEvent.mutate({ id: editingId, d });
    else addEvent.mutate(d);
  };

  const timeLabel = (e: CalEventItem): string =>
    e.startTime ? `${e.startTime}${e.endTime ? ` – ${e.endTime}` : ""}` : tx(lang, "Cả ngày", "All day");
  const rangeLabel = (e: CalEventItem): string =>
    e.endDate && e.endDate > e.date
      ? `${fmtDate(`${e.date}T00:00:00`, lang)} → ${fmtDate(`${e.endDate}T00:00:00`, lang)}`
      : "";

  const renderDayItems = (key: string, b: DayBucket | undefined) => {
    if (!b || (b.events.length === 0 && b.sessions.length === 0 && b.dueWords.length === 0 && b.deadlines.length === 0)) {
      return <p style={{ color: "var(--dim)" }}>{tx(lang, "Chưa có gì trong ngày này.", "Nothing on this day.")}</p>;
    }
    return (
      <>
        {b.events.map((e) => (
          <div key={e.id} className="flex flex-wrap items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: colorHex(e.color) }} />
            <span className="font-semibold" style={{ color: "var(--dim)" }}>{timeLabel(e)}</span>
            <span className="min-w-0 flex-1 font-semibold">{e.title}</span>
            {rangeLabel(e) ? <span className="w-full pl-5" style={{ color: "var(--dim)" }}>{rangeLabel(e)}</span> : null}
            {e.note ? <span className="w-full pl-5" style={{ color: "var(--dim)" }}>{e.note}</span> : null}
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => openEditEvent(e)} aria-label={`${tx(lang, "Sửa sự kiện", "Edit event")}: ${e.title}`}>
              <Icon name="edit" size={12} />
            </button>
            <button type="button" className="btn btn-sm btn-ghost btn-danger" onClick={() => setConfirmDeleteEvent(e)} aria-label={`${tx(lang, "Xóa sự kiện", "Delete event")}: ${e.title}`}>
              <Icon name="trash" size={12} />
            </button>
          </div>
        ))}
        {b.sessions.map((s) => (
          <p key={s.id} className="flex flex-wrap items-center gap-2">
            <span style={{ color: "var(--blue)" }}><Icon name="clock" size={12} /></span>
            <span className="flex-1 font-semibold">{s.title}</span>
            <span style={{ color: "var(--dim)" }}>{s.minutes} {t(lang, "minutes")}</span>
          </p>
        ))}
        {b.dueWords.map((w) => (
          <p key={w.id} className="flex flex-wrap items-center gap-2">
            <span style={{ color: "var(--violet)" }}><Icon name="layers" size={12} /></span>
            <span className="flex-1 font-semibold">{w.word}</span>
            <span style={{ color: "var(--dim)" }}>{tx(lang, "Đến hạn ôn", "Due for review")}</span>
          </p>
        ))}
        {b.deadlines.map((g) => (
          <p key={g.id} className="flex flex-wrap items-center gap-2">
            <span style={{ color: "var(--accent)" }}><Icon name="target" size={12} /></span>
            <span className="flex-1 font-semibold">{goalTitle(g, lang)}</span>
            <span style={{ color: "var(--dim)" }}>{tx(lang, "Hạn mục tiêu", "Goal deadline")}</span>
          </p>
        ))}
      </>
    );
  };

  const sel = byDay.get(selected);

  const eventForm = draft ? (
    <div className="card grid gap-2 p-3">
      <p className="font-display text-sm font-bold">
        {editingId != null ? (tx(lang, "Sửa sự kiện", "Edit event")) : tx(lang, "Thêm sự kiện", "Add event")}
      </p>
      <input
        maxLength={120} required
        className="input"
        value={draft.title}
        onChange={(e) => setDraft({ ...draft, title: e.target.value })}
        placeholder={tx(lang, "Tên sự kiện (vd: Học ngữ pháp Unit 5)", "Event title")}
        aria-label={tx(lang, "Tên sự kiện", "Event title")}
        autoFocus
      />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <label className="grid gap-0.5">
          <span style={{ color: "var(--dim)" }}>{tx(lang, "Ngày bắt đầu", "Start day")}</span>
          <input
            required
            type="date"
            className="input"
            value={draft.date}
            onChange={(e) => setDraft({ ...draft, date: e.target.value, endDate: draft.endDate < e.target.value ? e.target.value : draft.endDate })}
            aria-label={tx(lang, "Ngày bắt đầu", "Start day")}
          />
        </label>
        <label className="grid gap-0.5">
          <span style={{ color: "var(--dim)" }}>{tx(lang, "Ngày kết thúc", "End day")}</span>
          <input
            required
            type="date"
            className="input"
            value={draft.endDate}
            min={draft.date}
            onChange={(e) => setDraft({ ...draft, endDate: e.target.value })}
            aria-label={tx(lang, "Ngày kết thúc", "End day")}
          />
        </label>
        <label className="grid gap-0.5">
          <span style={{ color: "var(--dim)" }}>{tx(lang, "Bắt đầu", "Start")}</span>
          <input
            type="time"
            className="input"
            value={draft.startTime}
            onChange={(e) => setDraft({ ...draft, startTime: e.target.value })}
            aria-label={tx(lang, "Giờ bắt đầu", "Start time")}
          />
        </label>
        <label className="grid gap-0.5">
          <span style={{ color: "var(--dim)" }}>{tx(lang, "Kết thúc", "End")}</span>
          <input
            type="time"
            className="input"
            value={draft.endTime}
            onChange={(e) => setDraft({ ...draft, endTime: e.target.value })}
            aria-label={tx(lang, "Giờ kết thúc", "End time")}
          />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="pr-1" style={{ color: "var(--dim)" }}>{tx(lang, "Màu", "Colour")}</span>
        {EVENT_COLORS.map((c) => (
          <button
            key={c.key}
            type="button"
            className="h-6 w-6 rounded-full"
            style={{
              background: c.hex,
              outline: draft.color === c.key ? "2px solid var(--text)" : "none",
              outlineOffset: 2,
            }}
            onClick={() => setDraft({ ...draft, color: c.key })}
            aria-label={`${tx(lang, "Màu", "Colour")} ${c.key}`}
            aria-pressed={draft.color === c.key}
          />
        ))}
        <label
          className="relative flex h-6 w-6 cursor-pointer items-center justify-center overflow-hidden rounded-full"
          style={{
            background: "conic-gradient(#f87171, #facc15, #34d399, #38bdf8, #7c3aed, #f472b6, #f87171)",
            outline: draft.color.startsWith("#") ? "2px solid var(--text)" : "none",
            outlineOffset: 2,
          }}
          title={tx(lang, "Chọn màu tùy ý", "Pick a custom colour")}
        >
          <input
            type="color"
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            value={draft.color.startsWith("#") ? draft.color : "#7c3aed"}
            onChange={(e) => setDraft({ ...draft, color: e.target.value })}
            aria-label={tx(lang, "Chọn màu tùy ý", "Pick a custom colour")}
          />
        </label>
        {draft.color.startsWith("#") ? (
          <span className="chip" style={{ background: draft.color, color: "#fff" }}>{draft.color}</span>
        ) : null}
      </div>
      <textarea
        maxLength={500}
        className="input"
        rows={2}
        value={draft.note}
        onChange={(e) => setDraft({ ...draft, note: e.target.value })}
        placeholder={tx(lang, "Ghi chú (không bắt buộc)", "Note (optional)")}
        aria-label={tx(lang, "Ghi chú", "Note")}
      />
      {formError ? <p style={{ color: "var(--bad)" }}>{formError}</p> : null}
      <div className="flex gap-2">
        <button type="button" className="btn btn-orange" disabled={addEvent.isPending || updateEvent.isPending} onClick={saveDraft}>
          <Icon name="check" size={13} /> {tx(lang, "Lưu sự kiện", "Save event")}
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => { setDraft(null); setEditingId(null); }}>
          {t(lang, "cancel")}
        </button>
      </div>
    </div>
  ) : null;

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <SectionTitle>{tx(lang, "Lịch học", "Study calendar")}</SectionTitle>
        <span className="ml-auto flex items-center gap-1">
          <button type="button" className="btn btn-sm" onClick={goToday}>{tx(lang, "Hôm nay", "Today")}</button>
          <button type="button" className="btn btn-sm" onClick={() => move(-1)} aria-label={tx(lang, "Lùi", "Previous")}>
            <Icon name="chevL" size={13} />
          </button>
          <span className="min-w-28 text-center font-bold capitalize">{periodLabel}</span>
          <button type="button" className="btn btn-sm" onClick={() => move(1)} aria-label={tx(lang, "Tiến", "Next")}>
            <Icon name="chevR" size={13} />
          </button>
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <button type="button" className={`tabbtn ${mode === "month" ? "active" : ""}`} onClick={() => setMode("month")}>{tx(lang, "Tháng", "Month")}</button>
        <button type="button" className={`tabbtn ${mode === "week" ? "active" : ""}`} onClick={() => setMode("week")}>{tx(lang, "Tuần", "Week")}</button>
        <button type="button" className={`tabbtn ${mode === "agenda" ? "active" : ""}`} onClick={() => setMode("agenda")}>{tx(lang, "Lịch trình", "Agenda")}</button>
        <button type="button" className="btn btn-orange ml-auto" onClick={() => openNewEvent(selected)} title={tx(lang, "Thêm sự kiện học tập vào ngày đang chọn", "Add a study event on the selected day")}>
          <Icon name="plus" size={13} /> {tx(lang, "Thêm sự kiện", "Add event")}
        </button>
      </div>

      {eventForm}

      {mode === "month" ? (
        <div className="card p-2.5">
          <div className="grid grid-cols-7 gap-1 pb-1 text-center font-bold" style={{ color: "var(--dim)" }}>
            {weekShort.map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {monthCells.map((d, i) => {
              if (d === null) return <span key={`x-${i}`} />;
              const key = monthKeyOf(d);
              const b = byDay.get(key);
              const isToday = key === todayKey();
              const isSel = key === selected;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => { setSelected(key); setAnchor(key); }}
                  aria-label={`${key}${b ? ` — ${b.events.length} ${tx(lang, "sự kiện", "events")}, ${b.minutes} ${t(lang, "minutes")}` : ""}`}
                  aria-pressed={isSel}
                  className="grid min-h-14 content-start gap-0.5 rounded-lg border p-1 text-left"
                  style={{
                    borderColor: isSel ? "var(--accent)" : "var(--border)",
                    background: isSel ? "var(--surface2)" : "transparent",
                  }}
                >
                  <span
                    className="flex h-5 w-5 items-center justify-center rounded-full font-bold leading-none"
                    style={isToday ? { background: "var(--accent)", color: "var(--accent-text)" } : undefined}
                  >
                    {d}
                  </span>
                  {b?.events.slice(0, 2).map((e) => (
                    <span
                      key={e.id}
                      className="truncate rounded px-1 leading-tight text-white"
                      style={{ background: colorHex(e.color), fontSize: 10 }}
                    >
                      {e.startTime ? `${e.startTime} ` : ""}{e.title}
                    </span>
                  ))}
                  {b && b.events.length > 2 ? (
                    <span className="leading-none" style={{ color: "var(--dim)", fontSize: 10 }}>
                      +{b.events.length - 2} {tx(lang, "sự kiện", "events")}
                    </span>
                  ) : null}
                  {b && b.minutes > 0 ? (
                    <span className="leading-none" style={{ color: "var(--blue)", fontSize: 10 }}>{b.minutes} {t(lang, "minutes")}</span>
                  ) : null}
                  {b && b.dueWords.length > 0 ? (
                    <span className="leading-none" style={{ color: "var(--violet)", fontSize: 10 }}>{b.dueWords.length} {t(lang, "words")} ôn</span>
                  ) : null}
                  {b && b.deadlines.length > 0 ? (
                    <span className="leading-none" style={{ color: "var(--accent)", fontSize: 10 }}>★ {tx(lang, "hạn mục tiêu", "goal due")}</span>
                  ) : null}
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-3 pt-2" style={{ color: "var(--dim)" }}>
            <span><span style={{ color: "var(--violet)" }}>●</span> {tx(lang, "Sự kiện của bạn", "Your events")}</span>
            <span><span style={{ color: "var(--blue)" }}>●</span> {tx(lang, "Buổi học", "Sessions")}</span>
            <span><span style={{ color: "var(--violet)" }}>●</span> {tx(lang, "Từ đến hạn ôn", "Words due")}</span>
            <span><span style={{ color: "var(--accent)" }}>●</span> {tx(lang, "Hạn mục tiêu", "Goal deadlines")}</span>
          </div>
        </div>
      ) : null}

      {mode === "week" ? (
        <div className="grid gap-1.5">
          {weekDaysList.map((key, i) => {
            const b = byDay.get(key);
            const isToday = key === todayKey();
            const isSel = key === selected;
            return (
              <div
                key={key}
                className="card grid gap-1.5 p-2.5"
                style={isSel ? { borderColor: "var(--accent)" } : undefined}
              >
                <button
                  type="button"
                  className="flex items-center gap-2 text-left"
                  onClick={() => { setSelected(key); setAnchor(key); }}
                  aria-pressed={isSel}
                >
                  <span
                    className="flex h-6 w-6 items-center justify-center rounded-full font-display text-sm font-extrabold"
                    style={isToday ? { background: "var(--accent)", color: "var(--accent-text)" } : { background: "var(--surface3)" }}
                  >
                    {parseKey(key).getDate()}
                  </span>
                  <span className="font-bold">{weekDayNames[i]}</span>
                  <span style={{ color: "var(--dim)" }}>{fmtDate(`${key}T00:00:00`, lang)}</span>
                  <span className="ml-auto" style={{ color: "var(--dim)" }}>
                    {b && b.minutes > 0 ? `${b.minutes} ${t(lang, "minutes")}` : ""}
                  </span>
                </button>
                {isSel ? (
                  <>
                    {renderDayItems(key, b)}
                    <div>
                      <button type="button" className="btn btn-sm" onClick={() => openNewEvent(key)}>
                        <Icon name="plus" size={12} /> {tx(lang, "Thêm sự kiện", "Add event")}
                      </button>
                    </div>
                  </>
                ) : b && b.events.length > 0 ? (
                  <div className="grid gap-0.5 pl-8">
                    {b.events.map((e) => (
                      <p key={e.id} className="flex items-center gap-2">
                        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: colorHex(e.color) }} />
                        <span style={{ color: "var(--dim)" }}>{timeLabel(e)}</span>
                        <span className="font-semibold">{e.title}</span>
                      </p>
                    ))}
                  </div>
                ) : (
                  <p className="pl-8" style={{ color: "var(--dim)" }}>{tx(lang, "Không có sự kiện.", "No events.")}</p>
                )}
              </div>
            );
          })}
        </div>
      ) : null}

      {mode === "agenda" ? (
        <div className="grid gap-1.5">
          {agendaDays.length === 0 ? (
            <div className="card p-3 text-center">
              <p style={{ color: "var(--dim)" }}>
                {tx(lang, "30 ngày tới chưa có gì trong lịch. Bấm “Thêm sự kiện” để lên lịch học đầu tiên nhé.", "Nothing scheduled in the next 30 days. Tap “Add event” to plan your first study session.")}
              </p>
            </div>
          ) : (
            agendaDays.map((key) => (
              <div key={key} className="card grid gap-1.5 p-2.5">
                <p className="font-display text-sm font-bold">
                  {fmtDate(`${key}T00:00:00`, lang)}
                  {key === todayKey() ? <span className="chip chip-orange ml-2">{tx(lang, "Hôm nay", "Today")}</span> : null}
                </p>
                {renderDayItems(key, byDay.get(key))}
              </div>
            ))
          )}
        </div>
      ) : null}

      {mode === "month" ? (
        <div className="card grid gap-1.5 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-display text-sm font-bold">{fmtDate(`${selected}T00:00:00`, lang)}</p>
            <button type="button" className="btn btn-sm ml-auto" onClick={() => openNewEvent(selected)}>
              <Icon name="plus" size={12} /> {tx(lang, "Thêm sự kiện", "Add event")}
            </button>
          </div>
          {renderDayItems(selected, sel)}
        </div>
      ) : null}

      {confirmDeleteEvent ? (
        <ConfirmDialog
          lang={lang}
          message={txf(lang, "Xóa sự kiện “{0}” khỏi lịch?", "Delete the event “{0}” from the calendar?", confirmDeleteEvent.title)}
          confirmLabel={tx(lang, "Xóa sự kiện", "Delete event")}
          onConfirm={() => deleteEvent.mutate(confirmDeleteEvent.id)}
          onCancel={() => setConfirmDeleteEvent(null)}
        />
      ) : null}
    </div>
  );
}
