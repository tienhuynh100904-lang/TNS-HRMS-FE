"use client";

import { useState } from "react";
import { api, type DailyAttendance, type PullResult, query } from "@/lib/api";
import { Listbox } from "../controls";
import { branchName, type Column, DataTable, FilterBar, Pager, time, usePaged } from "../shared";

const STATUS: Record<DailyAttendance["status"], { label: string; className: string }> = {
  OK: { label: "Đủ công", className: "bg-green-100 text-green-800" },
  SINGLE_PUNCH: { label: "Thiếu quẹt", className: "bg-red-100 text-brand-dark" },
  IN_PROGRESS: { label: "Đang làm", className: "bg-gold-soft text-amber-900" },
};

const FLAGS = [
  { value: "", label: "Tất cả" },
  { value: "LATE_OR_EARLY", label: "Đi trễ hoặc về sớm" },
  { value: "LATE", label: "Đi trễ" },
  { value: "EARLY", label: "Về sớm" },
  { value: "MISSING", label: "Thiếu quẹt (có giờ vào, không có giờ ra)" },
];

// shortcut: everyone is measured against the main shift 08:00-17:00; use each person's own shift once shifts are
// assigned to employees. Minutes only, as shown on screen: 08:00:40 is still on time.
const minutes = (value: string) => Number(value.slice(11, 13)) * 60 + Number(value.slice(14, 16));
const lateBy = (r: DailyAttendance) => Math.max(0, minutes(r.checkInTime) - 8 * 60);
const earlyBy = (r: DailyAttendance) => (r.checkOutTime ? Math.max(0, 17 * 60 - minutes(r.checkOutTime)) : 0);

// what each sortable column sorts by (the names are the `field`s of COLUMNS)
const SORT_BY = {
  branch: (r: DailyAttendance) => branchName(r.branchCode),
  userCode: (r: DailyAttendance) => r.userCode,
  employeeCode: (r: DailyAttendance) => r.employeeCode,
  fullName: (r: DailyAttendance) => r.fullName,
  department: (r: DailyAttendance) => r.departmentName,
  checkIn: (r: DailyAttendance) => r.checkInTime,
  checkOut: (r: DailyAttendance) => r.checkOutTime,
  punchCount: (r: DailyAttendance) => r.punchCount,
  status: (r: DailyAttendance) => STATUS[r.status]?.label ?? r.status,
};

const COLUMNS: Column[] = [
  { label: "Chi nhánh", field: "branch" },
  { label: "Mã CC", field: "userCode" },
  { label: "Mã NV", field: "employeeCode" },
  { label: "Họ tên", field: "fullName" },
  { label: "Phòng ban", field: "department" },
  { label: "Giờ vào", field: "checkIn" },
  { label: "Giờ ra", field: "checkOut" },
  { label: "Số lượt", field: "punchCount" },
  { label: "Trạng thái", field: "status" },
];

const MATCHERS: Record<string, (r: DailyAttendance) => boolean> = {
  LATE_OR_EARLY: (r) => lateBy(r) > 0 || earlyBy(r) > 0,
  LATE: (r) => lateBy(r) > 0,
  EARLY: (r) => earlyBy(r) > 0,
  MISSING: (r) => !r.checkOutTime,
};

// A time that shows `note` in a brand-coloured bubble on hover / keyboard focus; plain text when there is no note.
// The bubble opens upwards: the table box clips what would stick out below its last row.
function Hint({ note, children }: { note: string; children: React.ReactNode }) {
  if (!note) return <>{children}</>;
  return (
    <span tabIndex={0} aria-label={`${children} - ${note}`} className="group relative cursor-help underline decoration-brand/50 decoration-dotted underline-offset-4 outline-none">
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 whitespace-nowrap rounded-md bg-brand-dark px-2.5 py-1.5 text-xs font-medium text-white opacity-0 shadow-lg transition group-hover:opacity-100 group-focus-visible:opacity-100"
      >
        {note}
        <span className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-brand-dark" />
      </span>
    </span>
  );
}

export default function AttendancePage() {
  const { filters, setFilters, sort, setSort, setPage, data, truncated, error, loading, refresh } =
    usePaged<DailyAttendance>("/api/v1/attendance/daily", { matchers: MATCHERS, columns: SORT_BY });
  const [pulling, setPulling] = useState(false);
  const [pull, setPull] = useState<{ results?: PullResult[]; error?: string } | null>(null);

  async function pullNow() {
    setPulling(true);
    setPull(null);
    try {
      const results = await api<PullResult[]>(
        `/api/v1/attendance/pull?${query({ branchCode: filters.branchCode })}`,
        { method: "POST" },
      );
      setPull({ results });
      refresh();
    } catch (e) {
      setPull({ error: (e as Error).message });
    } finally {
      setPulling(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl uppercase tracking-wide text-brand-dark">Bảng công ngày</h1>
          <p className="text-sm text-gray-500">
            Giờ vào / ra của từng người, tính từ lượt quẹt thẻ. Đi trễ / về sớm so với ca chính{" "}
            <b className="text-brand-dark">08:00 – 17:00</b>.
          </p>
        </div>
        <button
          onClick={pullNow}
          disabled={pulling}
          className="rounded-md bg-gold px-4 py-2 text-sm font-semibold text-brand-dark shadow-sm hover:brightness-95 disabled:opacity-60"
        >
          {pulling ? "Đang kéo dữ liệu..." : `Kéo dữ liệu máy chấm công${filters.branchCode ? "" : " (tất cả)"}`}
        </button>
      </div>

      {pull && (
        <div className="rounded-lg border border-gold bg-gold-soft/50 p-4 text-sm" role="status">
          <div className="mb-1 flex justify-between">
            <b>Kết quả kéo dữ liệu</b>
            <button onClick={() => setPull(null)} aria-label="Đóng" className="text-gray-500 hover:text-gray-800">
              ✕
            </button>
          </div>
          {pull.error && <p className="text-red-700">{pull.error}</p>}
          {pull.results?.map((r) => (
            <p key={r.branchCode}>
              <b>{branchName(r.branchCode)}:</b>{" "}
              {r.result ? (
                `nhận ${r.result.received}, thêm mới ${r.result.inserted}, trùng ${r.result.duplicates}, bỏ qua ${r.result.skipped}`
              ) : (
                <span className="text-red-700">lỗi - {r.error}</span>
              )}
            </p>
          ))}
        </div>
      )}

      <FilterBar filters={filters} onChange={setFilters}>
        <Listbox
          label="Lọc"
          value={filters.flag}
          options={FLAGS}
          onChange={(flag) => setFilters({ ...filters, flag })}
          className="min-w-48"
        />
      </FilterBar>

      <DataTable
        head={COLUMNS}
        sort={sort}
        onSort={setSort}
        loading={loading}
        error={error}
        empty={!data?.result.length}
      >
        {data?.result.map((r) => (
          <tr
            key={`${r.branchCode}-${r.userCode}-${r.checkInTime}`}
            className={`hover:bg-gold-soft/30 ${lateBy(r) || earlyBy(r) ? "border-l-4 border-l-brand bg-brand/[0.03]" : ""}`}
          >
            <td className="whitespace-nowrap px-4 py-2.5 text-gray-600">{branchName(r.branchCode)}</td>
            <td className="px-4 py-2.5 font-mono">{r.userCode}</td>
            <td className="px-4 py-2.5 font-mono">{r.employeeCode ?? "—"}</td>
            <td className="whitespace-nowrap px-4 py-2.5 font-medium">{r.fullName ?? <i className="text-gray-400">Chưa gán NV</i>}</td>
            <td className="px-4 py-2.5 text-gray-600">{r.departmentName ?? "—"}</td>
            <td className={`whitespace-nowrap px-4 py-2.5 font-semibold ${lateBy(r) ? "text-brand" : "text-green-700"}`}>
              <Hint note={lateBy(r) ? `Đi trễ ${lateBy(r)} phút (ca vào 08:00)` : ""}>{time(r.checkInTime, r.workDate)}</Hint>
            </td>
            <td className={`whitespace-nowrap px-4 py-2.5 font-semibold ${earlyBy(r) ? "text-brand" : "text-gray-700"}`}>
              <Hint note={earlyBy(r) ? `Về sớm ${earlyBy(r)} phút (ca ra 17:00)` : ""}>{time(r.checkOutTime, r.workDate)}</Hint>
            </td>
            <td className="px-4 py-2.5 text-center">{r.punchCount}</td>
            <td className="px-4 py-2.5">
              <span className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS[r.status]?.className}`}>
                {STATUS[r.status]?.label ?? r.status}
              </span>
            </td>
          </tr>
        ))}
      </DataTable>

      <Pager meta={data?.meta} onPage={setPage} truncated={truncated} />
    </div>
  );
}
