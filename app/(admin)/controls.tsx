"use client";

import { useEffect, useId, useRef, useState } from "react";

const field =
  "flex w-full items-center justify-between gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-left text-sm outline-none transition hover:border-brand/60 focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/20 aria-expanded:border-brand aria-expanded:ring-2 aria-expanded:ring-brand/20";
const popup = "absolute top-full z-20 mt-1 rounded-lg border border-gray-200 bg-white shadow-lg";

/** Open/close state of a popup that closes on Escape or a click outside `ref`. */
function usePopup() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return { open, setOpen, ref };
}

const Chevron = ({ className = "" }: { className?: string }) => (
  <svg viewBox="0 0 20 20" aria-hidden className={`size-4 shrink-0 transition ${className}`}>
    <path d="M5 7.5l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export type Option = { value: string; label: string };

/** Pick one of `options`: a button that opens a list (arrows, Home/End, Enter, Escape). */
export function Listbox({
  label,
  value,
  options,
  onChange,
  className = "",
}: {
  label: string;
  value: string;
  options: Option[];
  onChange: (value: string) => void;
  className?: string;
}) {
  const { open, setOpen, ref } = usePopup();
  const id = useId();
  const selected = Math.max(0, options.findIndex((o) => o.value === value));
  const [active, setActive] = useState(selected);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (open) listRef.current?.focus();
  }, [open]);

  function show() {
    setActive(selected);
    setOpen(true);
  }

  function pick(i: number) {
    onChange(options[i].value);
    setOpen(false);
    ref.current?.querySelector("button")?.focus();
  }

  function onListKey(e: React.KeyboardEvent) {
    const move: Record<string, number> = { ArrowDown: active + 1, ArrowUp: active - 1, Home: 0, End: options.length - 1 };
    if (e.key in move) {
      e.preventDefault();
      setActive(Math.min(options.length - 1, Math.max(0, move[e.key])));
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      pick(active);
    } else if (e.key === "Tab") setOpen(false);
  }

  return (
    <div ref={ref} className={`relative flex flex-col gap-1 text-xs font-medium text-gray-600 ${className}`}>
      <span id={`${id}-label`}>{label}</span>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby={`${id}-label ${id}-value`}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            show();
          }
        }}
        className={`${field} font-normal text-gray-900`}
      >
        <span id={`${id}-value`} className="truncate">
          {options[selected]?.label}
        </span>
        <Chevron className={open ? "rotate-180 text-brand" : "text-gray-400"} />
      </button>
      {open && (
        <ul
          ref={listRef}
          role="listbox"
          tabIndex={-1}
          aria-labelledby={`${id}-label`}
          aria-activedescendant={`${id}-${active}`}
          onKeyDown={onListKey}
          className={`${popup} left-0 max-h-64 w-full min-w-max overflow-auto py-1 outline-none`}
        >
          {options.map((o, i) => (
            <li
              key={o.value}
              id={`${id}-${i}`}
              role="option"
              aria-selected={i === selected}
              onMouseEnter={() => setActive(i)}
              onClick={() => pick(i)}
              className={`flex cursor-pointer items-center justify-between gap-4 px-3 py-2 text-sm font-normal ${
                i === active ? "bg-gold-soft/60 text-brand-dark" : "text-gray-800"
              } ${i === selected ? "font-semibold text-brand-dark" : ""}`}
            >
              {o.label}
              {i === selected && (
                <svg viewBox="0 0 20 20" aria-hidden className="size-4 text-brand">
                  <path d="M4 10.5l4 4 8-9" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const WEEKDAYS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
// local yyyy-MM-dd, the same form as <input type="date">
const iso = (d: Date) => d.toLocaleDateString("sv-SE");

/** Pick a day (value and onChange in yyyy-MM-dd) from a month calendar, weeks starting on Monday. */
export function DatePicker({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const { open, setOpen, ref } = usePopup();
  const id = useId();
  const [y, m] = value.split("-").map(Number);
  const [month, setMonth] = useState(new Date(y, m - 1, 1));
  // only read once the calendar is open (a click in the browser): a Date read while rendering would be frozen by the prerender
  const today = open ? iso(new Date()) : "";

  const year = month.getFullYear();
  const mon = month.getMonth();
  const blanks = (new Date(year, mon, 1).getDay() + 6) % 7; // Monday first
  const days = new Date(year, mon + 1, 0).getDate();
  const shift = (n: number) => setMonth(new Date(year, mon + n, 1));

  function pick(day: string) {
    onChange(day);
    setOpen(false);
    ref.current?.querySelector("button")?.focus();
  }

  const nav = "rounded-md p-1.5 text-gray-500 hover:bg-gold-soft/60 hover:text-brand-dark";

  return (
    <div ref={ref} className="relative flex flex-col gap-1 text-xs font-medium text-gray-600">
      <span id={`${id}-label`}>{label}</span>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-labelledby={`${id}-label ${id}-value`}
        onClick={() => {
          setMonth(new Date(y, m - 1, 1));
          setOpen(!open);
        }}
        className={`${field} min-w-40 font-normal text-gray-900`}
      >
        <span id={`${id}-value`}>{value ? value.split("-").reverse().join("/") : "—"}</span>
        <svg viewBox="0 0 20 20" aria-hidden className="size-4 text-brand">
          <rect x="3" y="4.5" width="14" height="12" rx="2" fill="none" stroke="currentColor" strokeWidth="1.6" />
          <path d="M3 8.5h14M7 3v3M13 3v3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </button>
      {open && (
        <div role="dialog" aria-label={`Chọn ${label.toLowerCase()}`} className={`${popup} left-0 w-72 p-3`}>
          <div className="mb-2 flex items-center justify-between">
            <button type="button" onClick={() => shift(-1)} aria-label="Tháng trước" className={nav}>
              <Chevron className="rotate-90" />
            </button>
            <span className="font-display text-base uppercase tracking-wide text-brand-dark" aria-live="polite">
              Tháng {mon + 1}/{year}
            </span>
            <button type="button" onClick={() => shift(1)} aria-label="Tháng sau" className={nav}>
              <Chevron className="-rotate-90" />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center">
            {WEEKDAYS.map((w) => (
              <span key={w} className={`py-1 text-[11px] font-semibold ${w === "CN" ? "text-brand" : "text-gray-400"}`}>
                {w}
              </span>
            ))}
            {Array.from({ length: blanks }, (_, i) => (
              <span key={`b${i}`} />
            ))}
            {Array.from({ length: days }, (_, i) => {
              const day = iso(new Date(year, mon, i + 1));
              const isSelected = day === value;
              const isToday = day === today;
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => pick(day)}
                  aria-label={day.split("-").reverse().join("/")}
                  aria-pressed={isSelected}
                  aria-current={isToday ? "date" : undefined}
                  className={`rounded-md py-1.5 text-sm font-normal outline-none transition focus-visible:ring-2 focus-visible:ring-brand/40 ${
                    isSelected
                      ? "bg-brand font-semibold text-white"
                      : isToday
                        ? "bg-gold-soft font-semibold text-brand-dark ring-1 ring-gold"
                        : "text-gray-800 hover:bg-gold-soft/60 hover:text-brand-dark"
                  }`}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>
          <div className="mt-3 flex justify-end border-t border-gray-100 pt-2">
            <button type="button" onClick={() => pick(today)} className="rounded-md px-3 py-1 text-sm font-semibold text-brand hover:bg-gold-soft/60">
              Hôm nay
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * A side panel that slides in from the right (and back out when closed), on the native <dialog> (Escape, focus trap and the backdrop come with
 * it). Mount it to open it; its children are laid out in a column, give the one that may grow `min-h-0 flex-1 overflow-auto`.
 */
export function Drawer({ title, onClose, children }: { title: React.ReactNode; onClose: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const closing = useRef(false);
  const still = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    const d = ref.current;
    if (!d || d.open) return;
    d.showModal();
    if (!still()) d.animate([{ transform: "translateX(100%)" }, { transform: "none" }], { duration: 220, easing: "ease-out" });
  }, []);

  // play the slide-out first; the dialog is really closed (and `onClose` called) once it has run
  function close() {
    const d = ref.current;
    if (!d || closing.current) return;
    closing.current = true;
    if (still()) return d.close();
    d.animate([{ transform: "none" }, { transform: "translateX(100%)" }], { duration: 180, easing: "ease-in", fill: "forwards" }).onfinish = () => d.close();
  }

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault(); // Escape: slide out instead of vanishing
        close();
      }}
      onClick={(e) => e.target === e.currentTarget && close()}
      className="m-0 ml-auto h-dvh max-h-none w-[min(36rem,100vw)] max-w-none overflow-visible bg-white p-0 shadow-2xl backdrop:bg-black/50 open:flex open:flex-col"
    >
      <div className="flex shrink-0 items-start justify-between gap-4 bg-brand-dark px-5 py-3 text-white">
        <h2 className="font-display text-xl uppercase tracking-wide">{title}</h2>
        <button
          type="button"
          autoFocus
          onClick={close}
          aria-label="Đóng"
          className="rounded-md px-2 py-1 text-white/80 outline-none hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-gold"
        >
          ✕
        </button>
      </div>
      <div className="h-1 shrink-0 bg-gold" />
      {children}
    </dialog>
  );
}

const MONTHS = Array.from({ length: 12 }, (_, i) => `Th${i + 1}`);

/** Pick a month (value and onChange in yyyy-MM): jump to any year with the arrows, then click the month. */
export function MonthPicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const { open, setOpen, ref } = usePopup();
  const [y, m] = value.split("-").map(Number);
  const [year, setYear] = useState(y);
  // only read once the picker is open (a click in the browser): a Date read while rendering would be frozen by the prerender
  const now = open ? iso(new Date()).slice(0, 7) : "";

  const nav = "rounded-md p-1.5 text-gray-500 hover:bg-gold-soft/60 hover:text-brand-dark";
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          setYear(y);
          setOpen(!open);
        }}
        className={`${field} min-w-36 justify-center font-display text-lg uppercase tracking-wide text-brand-dark`}
      >
        Tháng {m}/{y}
        <Chevron className={open ? "rotate-180 text-brand" : "text-gray-400"} />
      </button>
      {open && (
        <div role="dialog" aria-label="Chọn tháng" className={`${popup} right-0 w-64 p-3 text-gray-800`}>
          <div className="mb-2 flex items-center justify-between">
            <button type="button" onClick={() => setYear(year - 1)} aria-label="Năm trước" className={nav}>
              <Chevron className="rotate-90" />
            </button>
            <span className="font-display text-base tracking-wide text-brand-dark" aria-live="polite">
              {year}
            </span>
            <button type="button" onClick={() => setYear(year + 1)} aria-label="Năm sau" className={nav}>
              <Chevron className="-rotate-90" />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-1">
            {MONTHS.map((label, i) => {
              const ym = `${year}-${String(i + 1).padStart(2, "0")}`;
              return (
                <button
                  key={ym}
                  type="button"
                  aria-pressed={ym === value}
                  aria-current={ym === now ? "date" : undefined}
                  onClick={() => {
                    onChange(ym);
                    setOpen(false);
                    ref.current?.querySelector("button")?.focus();
                  }}
                  className={`rounded-md py-2 text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-brand/40 ${
                    ym === value
                      ? "bg-brand font-semibold text-white"
                      : ym === now
                        ? "bg-gold-soft font-semibold text-brand-dark ring-1 ring-gold"
                        : "hover:bg-gold-soft/60 hover:text-brand-dark"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/** Spring sort value ("field,asc" / "field,desc" / "" for none): a click goes asc -> desc -> none on that field. */
export const nextSort = (sort: string, field: string) =>
  sort === `${field},asc` ? `${field},desc` : sort === `${field},desc` ? "" : `${field},asc`;

export const ariaSort = (sort: string, field: string) =>
  sort === `${field},asc` ? "ascending" : sort === `${field},desc` ? "descending" : "none";

/** The content of a sortable <th>: the label as a button with an arrow showing the current direction. */
export function SortButton({ label, field, sort, onSort }: { label: string; field: string; sort: string; onSort: (sort: string) => void }) {
  const dir = sort === `${field},asc` ? "asc" : sort === `${field},desc` ? "desc" : "";
  return (
    <button
      type="button"
      onClick={() => onSort(nextSort(sort, field))}
      className="group inline-flex items-center gap-1.5 rounded uppercase tracking-wide outline-none focus-visible:ring-2 focus-visible:ring-gold"
    >
      {label}
      <svg viewBox="0 0 12 14" aria-hidden className="h-3.5 w-3">
        <path d="M6 1L2 5.5h8z" fill="currentColor" opacity={dir === "asc" ? 1 : dir ? 0.25 : 0.4} />
        <path d="M6 13L2 8.5h8z" fill="currentColor" opacity={dir === "desc" ? 1 : dir ? 0.25 : 0.4} />
      </svg>
    </button>
  );
}

/** An on/off switch with a label (role="switch"). */
export function Switch({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="group flex items-center gap-3 rounded-md text-left text-sm text-gray-800 outline-none focus-visible:ring-2 focus-visible:ring-brand/30"
    >
      <span className={`relative h-6 w-11 shrink-0 rounded-full transition ${checked ? "bg-brand" : "bg-gray-300"}`}>
        <span className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-all ${checked ? "left-[22px]" : "left-0.5"}`} />
      </span>
      {label}
    </button>
  );
}

/** A centred yes/no question on the native <dialog>. Mount it to open it; `onConfirm` stays on screen until it finishes. */
export function Confirm({
  title,
  children,
  confirmLabel,
  busy,
  error,
  onConfirm,
  onCancel,
}: {
  title: string;
  children: React.ReactNode;
  confirmLabel: string;
  busy?: boolean;
  error?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (ref.current && !ref.current.open) ref.current.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      onClose={onCancel}
      onCancel={(e) => busy && e.preventDefault()}
      className="m-auto w-[min(26rem,calc(100vw-2rem))] rounded-lg bg-white p-0 shadow-2xl backdrop:bg-black/50"
    >
      <div className="h-1.5 rounded-t-lg bg-brand" />
      <div className="space-y-3 p-5">
        <h2 className="font-display text-xl uppercase tracking-wide text-brand-dark">{title}</h2>
        <div className="text-sm text-gray-700">{children}</div>
        {error && (
          <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            autoFocus
            disabled={busy}
            onClick={() => ref.current?.close()}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium outline-none hover:border-brand hover:text-brand focus-visible:ring-2 focus-visible:ring-brand/30 disabled:opacity-50"
          >
            Hủy
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white outline-none hover:bg-brand-dark focus-visible:ring-2 focus-visible:ring-brand/40 disabled:opacity-60"
          >
            {busy ? "Đang xử lý..." : confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
