"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { api, getToken, type Page, query } from "@/lib/api";
import { ariaSort, DatePicker, Listbox, SortButton } from "./controls";

// shortcut: the backend has no branch list API yet, these mirror tns-hrms seed/branches.csv; load from an API once it exists.
export const BRANCHES = [
  { code: "KHO_BD", name: "Kho Bình Dương" },
  { code: "PKD_ND", name: "Kinh doanh nội địa Nhà Bè" },
  { code: "PKD_XK", name: "Kinh doanh xuất khẩu Nhà Bè" },
  { code: "TNS_LS", name: "Nhà máy sản xuất cuộn Tây Nam" },
];

export const branchName = (code: string) => BRANCHES.find((b) => b.code === code)?.name ?? code;

// local yyyy-MM-dd (toISOString would give the UTC day, wrong before 7am in Vietnam)
const today = () => new Date().toLocaleDateString("sv-SE");
const noSubscribe = () => () => {};

/** "2026-10-16T07:58:12" -> "07:58", plus the day when it is not `sameDay` (night shift). */
export function time(value: string | null, sameDay?: string) {
  if (!value) return "—";
  const hhmm = value.slice(11, 16);
  const day = value.slice(0, 10);
  return sameDay && day !== sameDay ? `${hhmm} (${day.slice(8, 10)}/${day.slice(5, 7)})` : hhmm;
}

// flag: client-side filter of the daily attendance (late, early, missing punch)
export type Filters = { date: string; branchCode: string; keyword: string; flag: string };

// shortcut: the backend can neither filter on the flag nor sort these lists, so with a flag or a sort on the whole day is
// fetched (Spring's max page size) and filtered/sorted/paged here; fine for a few hundred people a day, ask the backend
// for it beyond that (the page then warns that the day was cut)
const ALL = 2000;
const SIZE = 20;

/**
 * GET `url` (null: wait). The answer remembers which request it belongs to, so "loading" is simply "the answer is for
 * another request"; the previous data stays until the new one arrives.
 */
export function useFetch<T>(url: string | null) {
  const [reload, setReload] = useState(0);
  const [res, setRes] = useState<{ url: string | null; reload: number; data?: T; error?: string } | null>(null);

  useEffect(() => {
    if (!url || !getToken()) return; // no token: the layout is sending the user to /login
    let stale = false;
    api<T>(url)
      .then((data) => !stale && setRes({ url, reload, data }))
      .catch((e: Error) => !stale && setRes((r) => ({ url, reload, data: r?.data, error: e.message })));
    return () => {
      stale = true;
    };
  }, [url, reload]);

  return {
    data: res?.data ?? null,
    error: res?.error ?? "",
    loading: res?.url !== url || res.reload !== reload,
    refresh: () => setReload((r) => r + 1),
  };
}

type Cell = string | number | null;

/**
 * One page of a date/branch/keyword filtered list from the backend (Spring pages start at 0).
 * `matchers` maps a filters.flag value to a row test; `columns` maps a sortable column's field to the value to sort by
 * (null values go last in both directions). A flag or a sort is applied on the client, see ALL.
 */
export function usePaged<T>(
  path: string,
  { matchers, columns }: { matchers?: Record<string, (row: T) => boolean>; columns?: Record<string, (row: T) => Cell> } = {},
) {
  // "today" is read in the browser only (the server snapshot is ""): a Date read during the prerender would be frozen
  const todayValue = useSyncExternalStore(noSubscribe, today, () => "");
  const [picked, setFiltersState] = useState<Filters>({ date: "", branchCode: "", keyword: "", flag: "" });
  const filters = { ...picked, date: picked.date || todayValue };
  const [sort, setSortState] = useState("");
  const [page, setPage] = useState(0);
  const match = matchers?.[filters.flag];
  const [field, dir] = sort.split(",");
  const get = columns?.[field];
  const local = !!match || !!get;
  const { flag, ...params } = filters;
  void flag;
  const url = filters.date ? `${path}?${query({ ...params, page: local ? 0 : page, size: local ? ALL : SIZE })}` : null;
  const { data: raw, error, loading, refresh } = useFetch<Page<T>>(url);

  let data = raw;
  if (data && local) {
    let rows = match ? data.result.filter(match) : data.result;
    if (get) {
      const sign = dir === "desc" ? -1 : 1;
      rows = [...rows].sort((a, b) => {
        const x = get(a);
        const y = get(b);
        if (x == null || y == null) return x == null ? (y == null ? 0 : 1) : -1;
        const r = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), "vi", { numeric: true });
        return r * sign;
      });
    }
    data = {
      meta: { page: page + 1, pageSize: SIZE, pages: Math.ceil(rows.length / SIZE), total: rows.length },
      result: rows.slice(page * SIZE, (page + 1) * SIZE),
    };
  }
  const truncated = local && !!raw && raw.meta.total > ALL;

  const setFilters = (f: Filters) => {
    setFiltersState(f);
    setPage(0);
  };
  const setSort = (s: string) => {
    setSortState(s);
    setPage(0);
  };
  return { filters, setFilters, sort, setSort, page, setPage, data, truncated, error, loading, refresh };
}

export const input =
  "rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";

export function FilterBar({
  filters,
  onChange,
  children,
}: {
  filters: Filters;
  onChange: (f: Filters) => void;
  children?: React.ReactNode;
}) {
  const [keyword, setKeyword] = useState(filters.keyword);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onChange({ ...filters, keyword: keyword.trim() });
      }}
      className="flex flex-wrap items-end gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
    >
      <DatePicker label="Ngày" value={filters.date} onChange={(date) => onChange({ ...filters, date })} />
      <Listbox
        label="Chi nhánh"
        value={filters.branchCode}
        options={[{ value: "", label: "Tất cả chi nhánh" }, ...BRANCHES.map((b) => ({ value: b.code, label: b.name }))]}
        onChange={(branchCode) => onChange({ ...filters, branchCode })}
        className="min-w-56"
      />
      {children}
      <label className="flex min-w-56 flex-1 flex-col gap-1 text-xs font-medium text-gray-600">
        Tìm kiếm
        <input
          type="search"
          placeholder="Mã chấm công, mã nhân viên hoặc họ tên"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          className={input}
        />
      </label>
      <button className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark">
        Tìm
      </button>
    </form>
  );
}

/** A column header: plain text, or sortable by `field` (the name the backend sorts on). */
export type Column = string | { label: string; field: string };

export function DataTable({
  head,
  sort = "",
  onSort,
  loading,
  error,
  empty,
  children,
}: {
  head: Column[];
  sort?: string;
  onSort?: (sort: string) => void;
  loading: boolean;
  error: string;
  empty: boolean;
  children: React.ReactNode;
}) {
  const message = error || (loading && empty ? "Đang tải..." : empty ? "Không có dữ liệu cho bộ lọc này." : "");
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
      <table className={`w-full text-sm ${loading ? "opacity-60" : ""}`}>
        <thead className="bg-brand-dark text-left text-xs uppercase tracking-wide text-white">
          <tr>
            {head.map((h, i) =>
              typeof h === "string" ? (
                <th key={i} className="whitespace-nowrap px-4 py-3 font-semibold">
                  {h}
                </th>
              ) : (
                <th key={h.field} aria-sort={ariaSort(sort, h.field)} className="whitespace-nowrap px-4 py-3 font-semibold">
                  <SortButton label={h.label} field={h.field} sort={sort} onSort={onSort!} />
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {message ? (
            <tr>
              <td colSpan={head.length} className={`px-4 py-10 text-center ${error ? "text-red-600" : "text-gray-500"}`}>
                {message}
              </td>
            </tr>
          ) : (
            children
          )}
        </tbody>
      </table>
    </div>
  );
}

export function Pager({
  meta,
  onPage,
  truncated,
}: {
  meta?: Page<unknown>["meta"];
  onPage: (page: number) => void;
  truncated?: boolean;
}) {
  if (!meta || meta.total === 0) return null;
  const btn = "rounded-md border border-gray-300 bg-white px-3 py-1.5 hover:border-brand hover:text-brand disabled:opacity-40 disabled:hover:border-gray-300 disabled:hover:text-inherit";
  return (
    <div className="flex items-center justify-between text-sm text-gray-600">
      <span>
        Tổng <b className="text-brand-dark">{meta.total}</b> dòng
        {truncated && <span className="ml-3 text-amber-800">Ngày có hơn {ALL} dòng, chỉ lọc / sắp xếp {ALL} dòng đầu.</span>}
      </span>
      <div className="flex items-center gap-2">
        <button className={btn} disabled={meta.page <= 1} onClick={() => onPage(meta.page - 2)}>
          ‹ Trước
        </button>
        <span>
          Trang {meta.page}/{Math.max(meta.pages, 1)}
        </span>
        <button className={btn} disabled={meta.page >= meta.pages} onClick={() => onPage(meta.page)}>
          Sau ›
        </button>
      </div>
    </div>
  );
}
