// LaSpace frontend transport for the Cloudflare build.
//
// Drop-in replacement for the Muse build's client/src/api.ts. The React
// components call api.<action>(args) exactly as before; here each call is a
// POST to the Worker's /api/<action> route with the args as JSON, and a
// non-2xx response throws an Error carrying the server's message (the same
// contract the UI already handles).
//
// This file is already in place at frontend/src/api.ts (the whole Muse
// client's src/ ships in frontend/src/, adapted for Cloudflare):
//   - main.tsx uses a plain QueryClient from @tanstack/react-query and
//     renders into #root — no "@hatch/space-sdk" anywhere
//   - the FIELDS macro spreads were replaced with plain input attributes
//     (maxLength / min / max / required) matching server/src/actions.ts
//   - setFailureNoticeText / fileToBase64 are the stubs below

type Args = Record<string, unknown>;

async function call<T>(action: string, args: Args): Promise<T> {
  const res = await fetch(`/api/${action}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(args ?? {}),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(typeof data.error === "string" ? data.error : "Đã có lỗi xảy ra. Vui lòng thử lại nhé.");
  }
  return data as T;
}

// A proxy so api.anyActionName(args) works without declaring each action.
export const api = new Proxy(
  {},
  {
    get: (_target, prop: string) => (args: Args) => call(prop, args),
  },
) as Record<string, <T = unknown>(args: Args) => Promise<T>>;

// Type-level stubs for the aliases lib.tsx derives from the Muse SDK's
// typed client (ApiResponse<typeof api, "me"> etc.). The Cloudflare
// transport is untyped at runtime, so these resolve to `any` and the UI's
// response types stay permissive — the Worker returns the same JSON shapes.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ApiResponse<_Client = unknown, _Action = string> = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ApiRequest<_Action = string> = any;

// Stubs for the two SDK helpers the UI imports, so components compile
// unchanged on Cloudflare.
export function setFailureNoticeText(_fn: (error: unknown, message: string) => string): void {
  /* The Cloudflare build surfaces mutation errors inline; nothing to set. */
}
export function fileToBase64(file: File): Promise<{ dataBase64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      const comma = result.indexOf(",");
      resolve({ dataBase64: comma >= 0 ? result.slice(comma + 1) : result, mimeType: file.type });
    };
    reader.onerror = () => reject(reader.error ?? new Error("Không đọc được file."));
    reader.readAsDataURL(file);
  });
}
