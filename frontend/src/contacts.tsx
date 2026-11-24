import { useState } from "react";
import type { ContactItem } from "./lib";

// Preset platforms an admin can add in one tap; any other platform can be
// typed in freely (Threads, TikTok, a blog, …). The icon is never uploaded:
// it is fetched automatically from the platform's own domain via its
// favicon, with a letter tile as fallback.
export const PLATFORM_PRESETS: { name: string; hint: string }[] = [
  { name: "Zalo", hint: "https://zalo.me/…" },
  { name: "Telegram", hint: "https://t.me/…" },
  { name: "Facebook", hint: "https://www.facebook.com/…" },
  { name: "YouTube", hint: "https://www.youtube.com/…" },
  { name: "Threads", hint: "https://www.threads.net/…" },
  { name: "Instagram", hint: "https://www.instagram.com/…" },
  { name: "TikTok", hint: "https://www.tiktok.com/…" },
  { name: "X", hint: "https://x.com/…" },
  { name: "Messenger", hint: "https://m.me/…" },
  { name: "WhatsApp", hint: "https://wa.me/…" },
];

export function contactDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

export function ContactIcon({ contact, size = 34 }: { contact: ContactItem; size?: number }) {
  const [failed, setFailed] = useState(false);
  const domain = contactDomain(contact.url);
  const tile = {
    width: size,
    height: size,
    borderRadius: 10,
  } as const;
  if (!domain || failed) {
    return (
      <span
        aria-hidden="true"
        className="flex shrink-0 items-center justify-center font-display font-extrabold text-white"
        style={{ ...tile, background: "linear-gradient(135deg,#2f6bff,#7c3aed)", fontSize: size * 0.45 }}
      >
        {contact.platform.trim().charAt(0).toUpperCase() || "?"}
      </span>
    );
  }
  return (
    <span
      aria-hidden="true"
      className="flex shrink-0 items-center justify-center"
      style={{ ...tile, background: "#ffffff", border: "1px solid var(--border)" }}
    >
      <img
        src={`https://www.google.com/s2/favicons?domain=${domain}&sz=128`}
        alt=""
        width={size - 10}
        height={size - 10}
        style={{ borderRadius: 4 }}
        onError={() => setFailed(true)}
      />
    </span>
  );
}

export function ContactRow({
  contacts,
  label,
  dark = false,
}: {
  contacts: ContactItem[];
  label?: string;
  dark?: boolean;
}) {
  if (contacts.length === 0) return null;
  return (
    <div className="grid justify-items-center gap-1.5">
      {label ? (
        <p style={{ color: dark ? "#a7add8" : "var(--dim)" }}>{label}</p>
      ) : null}
      <div className="flex flex-wrap justify-center gap-2">
        {contacts.map((c) => (
          <a
            key={c.id}
            href={c.url}
            target="_blank"
            rel="noreferrer"
            aria-label={`${c.platform}: ${c.url}`}
            title={c.platform}
            className="inline-flex transition-transform hover:scale-105"
          >
            <ContactIcon contact={c} />
          </a>
        ))}
      </div>
    </div>
  );
}
