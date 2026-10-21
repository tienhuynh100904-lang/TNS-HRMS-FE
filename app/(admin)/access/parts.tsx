"use client";

import { useEffect, useRef, useState } from "react";
import { Drawer } from "../controls";

export const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];

const METHOD_COLORS: Record<string, string> = {
  GET: "bg-sky-100 text-sky-800",
  POST: "bg-green-100 text-green-800",
  PUT: "bg-amber-100 text-amber-800",
  PATCH: "bg-amber-100 text-amber-800",
  DELETE: "bg-red-100 text-red-800",
};

export function MethodBadge({ method }: { method: string }) {
  return (
    <span className={`inline-block w-16 rounded px-1.5 py-0.5 text-center font-mono text-[11px] font-bold ${METHOD_COLORS[method] ?? "bg-gray-100 text-gray-700"}`}>
      {method}
    </span>
  );
}

export function ActiveBadge({ active, on = "Đang bật", off = "Đã tắt" }: { active: boolean; on?: string; off?: string }) {
  return (
    <span
      className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${
        active ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"
      }`}
    >
      {active ? on : off}
    </span>
  );
}

/** "2026-10-20T08:00:00Z" -> "20/10/2026 15:00" (local time); the backend sends Instants. */
export const dateTime = (value: string | null) =>
  value ? new Date(value).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" }) : "—";

// spring-filter has no escape for these inside a quoted value, so they are dropped from what the user typed
export const clean = (keyword: string) => keyword.replace(/['\\*]/g, "").trim();

export const rowButton = "rounded-md border border-gray-300 px-3 py-1 text-sm font-medium hover:border-brand hover:text-brand";
export const deleteButton =
  "rounded-md border border-gray-300 px-3 py-1 text-sm font-medium text-gray-700 hover:border-red-600 hover:bg-red-600 hover:text-white";
export const addButton = "rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-dark";

/**
 * A side panel holding a form with Cancel / Save at the bottom. `onSubmit` throws to show its message; on success the
 * parent unmounts the drawer.
 */
export function FormDrawer({
  title,
  submitLabel = "Lưu",
  onClose,
  onSubmit,
  children,
}: {
  title: React.ReactNode;
  submitLabel?: string;
  onClose: () => void;
  onSubmit: () => Promise<void>;
  children: React.ReactNode;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await onSubmit();
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  }

  return (
    <Drawer title={title} onClose={onClose}>
      <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 space-y-4 overflow-auto overscroll-contain p-5">
          {error && (
            <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}
          {children}
        </div>
        <div className="flex shrink-0 justify-end gap-2 border-t border-gray-100 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium hover:border-brand hover:text-brand"
          >
            Hủy
          </button>
          <button
            disabled={saving}
            className="rounded-md bg-brand px-5 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-60"
          >
            {saving ? "Đang lưu..." : submitLabel}
          </button>
        </div>
      </form>
    </Drawer>
  );
}

/**
 * Shows a client's new secret, the one time the backend ever returns it. It only closes from its button, after the
 * admin has had the chance to copy it.
 */
export function SecretDialog({ clientId, secret, onClose }: { clientId: string; secret: string; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (ref.current && !ref.current.open) ref.current.showModal();
  }, []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
    } catch {
      // no clipboard (plain http): the secret is selected so Ctrl+C works
      ref.current?.querySelector("input")?.select();
    }
  }

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={(e) => e.preventDefault()}
      className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-lg bg-white p-0 shadow-2xl backdrop:bg-black/50"
    >
      <div className="h-1.5 rounded-t-lg bg-gold" />
      <div className="space-y-4 p-5">
        <h2 className="font-display text-xl uppercase tracking-wide text-brand-dark">Client Secret</h2>
        <p role="alert" className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Đây là <b>lần duy nhất</b> secret được hiển thị: máy chủ chỉ lưu bản băm. Hãy lưu ngay vào nơi an toàn (biến môi
          trường của ứng dụng dùng client này). Nếu mất, chỉ có thể đổi secret mới.
        </p>
        <div className="space-y-1 text-sm">
          <p className="text-xs font-medium text-gray-600">Client ID</p>
          <p className="font-mono font-semibold">{clientId}</p>
        </div>
        <div className="space-y-1">
          <p className="text-xs font-medium text-gray-600">Client Secret</p>
          <div className="flex gap-2">
            <input
              readOnly
              value={secret}
              onFocus={(e) => e.currentTarget.select()}
              className="min-w-0 flex-1 rounded-md border border-gray-300 bg-gray-50 px-3 py-2 font-mono text-sm"
            />
            <button
              type="button"
              autoFocus
              onClick={copy}
              className="shrink-0 rounded-md border border-brand px-3 py-2 text-sm font-semibold text-brand hover:bg-brand hover:text-white"
            >
              {copied ? "Đã chép" : "Sao chép"}
            </button>
          </div>
        </div>
        <div className="flex justify-end pt-1">
          <button
            type="button"
            onClick={() => ref.current?.close()}
            className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark"
          >
            Tôi đã lưu secret
          </button>
        </div>
      </div>
    </dialog>
  );
}
