import { useState, type FormEvent } from "react";
import { Icon, t, type Lang, type WordItem } from "./lib";
import { tx } from "./i18n";

// Cloudflare build: the Muse SDK's FIELDS macro is gone — every form
// input carries its plain attributes (maxLength / min / max / required)
// inline at the call site, with the same limits as the server schemas.

export function Stars({ rating, size = 12 }: { rating: number; size?: number }) {
  return (
    <span aria-label={`${rating}/5`} style={{ fontSize: size, letterSpacing: 1, lineHeight: 1 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} style={{ color: i <= rating ? "#ffb020" : "var(--dim)", opacity: i <= rating ? 1 : 0.45 }}>
          ★
        </span>
      ))}
    </span>
  );
}

export function ConfirmDialog({
  lang,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  lang: Lang;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(5,8,25,0.66)" }}
      role="dialog"
      aria-modal="true"
    >
      <div className="card w-full max-w-xs p-4">
        <p className="text-sm font-semibold">{message}</p>
        <div className="mt-3 flex justify-end gap-2">
          <button type="button" className="btn" onClick={onCancel} title={tx(lang, "Hủy và đóng hộp thoại này", "Cancel and close this dialog")}>
            {t(lang, "cancel")}
          </button>
          <button type="button" className="btn btn-orange" onClick={onConfirm} title={tx(lang, "Xác nhận thực hiện thao tác này", "Confirm this action")}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function Pager({
  lang,
  index,
  total,
  onPrev,
  onNext,
}: {
  lang: Lang;
  index: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  if (total <= 1) return null;
  return (
    <div className="mt-3 flex items-center justify-between">
      <button
        type="button"
        className="btn"
        onClick={onPrev}
        disabled={index <= 0}
        aria-label={tx(lang, "Trước", "Previous")}
        title={tx(lang, "Quay lại mục trước", "Go to the previous item")}
      >
        <Icon name="chevL" /> {tx(lang, "Trước", "Prev")}
      </button>
      <span style={{ color: "var(--dim)" }}>
        {index + 1} / {total}
      </span>
      <button
        type="button"
        className="btn btn-primary"
        onClick={onNext}
        disabled={index >= total - 1}
        aria-label={tx(lang, "Sau", "Next")}
        title={tx(lang, "Sang mục tiếp theo", "Go to the next item")}
      >
        {tx(lang, "Sau", "Next")} <Icon name="chevR" />
      </button>
    </div>
  );
}

export type WordDraft = {
  word: string;
  meaning: string;
  ipaUk: string;
  ipaUs: string;
  example: string;
};

export const emptyWordDraft: WordDraft = {
  word: "",
  meaning: "",
  ipaUk: "",
  ipaUs: "",
  example: "",
};

export function WordForm({
  lang,
  initial,
  submitLabel,
  pending,
  onSubmit,
}: {
  lang: Lang;
  initial: WordDraft;
  submitLabel: string;
  pending: boolean;
  onSubmit: (draft: WordDraft) => void;
}) {
  const [draft, setDraft] = useState<WordDraft>(initial);
  const [error, setError] = useState("");
  const L = lang === "vi";
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!draft.word.trim()) {
      setError(tx(lang, "Hãy nhập từ cần học nhé.", "Enter the word you are learning first."));
      return;
    }
    setError("");
    onSubmit(draft);
  };
  const set = (k: keyof WordDraft) => (e: { target: { value: string } }) =>
    setDraft((d) => ({ ...d, [k]: e.target.value }));
  return (
    <form onSubmit={submit} className="grid gap-2">
      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span style={{ color: "var(--dim)" }}>{tx(lang, "Từ cần học", "Word to learn")}</span>
          <input maxLength={80} required className="input" value={draft.word} onChange={set("word")} placeholder="example" />
        </label>
        <label className="block">
          <span style={{ color: "var(--dim)" }}>{tx(lang, "Nghĩa", "Meaning")}</span>
          <input maxLength={200} className="input" value={draft.meaning} onChange={set("meaning")} placeholder={tx(lang, "ví dụ", "meaning")} />
        </label>
        <label className="block">
          <span style={{ color: "var(--dim)" }}>IPA 1</span>
          <input maxLength={80} className="input" value={draft.ipaUk} onChange={set("ipaUk")} placeholder="/ɪɡˈzɑːmpl/" />
        </label>
        <label className="block">
          <span style={{ color: "var(--dim)" }}>IPA 2</span>
          <input maxLength={80} className="input" value={draft.ipaUs} onChange={set("ipaUs")} placeholder="/ɪɡˈzæmpl/" />
        </label>
      </div>
      <label className="block">
        <span style={{ color: "var(--dim)" }}>{tx(lang, "Ví dụ", "Example")}</span>
        <input maxLength={300} className="input" value={draft.example} onChange={set("example")} placeholder="This is an example." />
      </label>
      {error ? <p style={{ color: "var(--bad)" }}>{error}</p> : null}
      <div>
        <button type="submit" className="btn btn-orange" disabled={pending}>
          {submitLabel}
        </button>
      </div>
    </form>
  );
}

export function WordDetail({ lang, word }: { lang: Lang; word: WordItem }) {
  const L = lang === "vi";
  return (
    <div className="grid gap-1 pb-1" style={{ color: "var(--dim)" }}>
      {word.meaning ? (
        <p><span className="font-semibold" style={{ color: "var(--text)" }}>{tx(lang, "Nghĩa:", "Meaning:")}</span> {word.meaning}</p>
      ) : null}
      {word.ipaUk ? <p>IPA 1: {word.ipaUk}</p> : null}
      {word.ipaUs ? <p>IPA 2: {word.ipaUs}</p> : null}
      {word.example ? <p><em>“{word.example}”</em></p> : null}
    </div>
  );
}
