"use client";

import type { PunchUser } from "@/lib/api";
import { branchName, type Column, DataTable, FilterBar, Pager, time, usePaged } from "../shared";

// what each sortable column sorts by (the names are the `field`s of COLUMNS)
const SORT_BY = {
  time: (r: PunchUser) => r.punchTime,
  branch: (r: PunchUser) => branchName(r.branchCode),
  userCode: (r: PunchUser) => r.userCode,
  employeeCode: (r: PunchUser) => r.employeeCode,
  fullName: (r: PunchUser) => r.fullName,
  department: (r: PunchUser) => r.departmentName,
};

const COLUMNS: Column[] = [
  { label: "Giờ quẹt", field: "time" },
  { label: "Chi nhánh", field: "branch" },
  { label: "Mã CC", field: "userCode" },
  { label: "Mã NV", field: "employeeCode" },
  { label: "Họ tên", field: "fullName" },
  { label: "Phòng ban", field: "department" },
];

export default function PunchesPage() {
  const { filters, setFilters, sort, setSort, setPage, data, truncated, error, loading } = usePaged<PunchUser>(
    "/api/v1/attendance/users",
    { columns: SORT_BY },
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-3xl uppercase tracking-wide text-brand-dark">Lượt quẹt thẻ</h1>
        <p className="text-sm text-gray-500">Từng lượt quẹt thẻ trong ngày, cũ nhất trước.</p>
      </div>

      <FilterBar filters={filters} onChange={setFilters} />

      <DataTable
        head={COLUMNS}
        sort={sort}
        onSort={setSort}
        loading={loading}
        error={error}
        empty={!data?.result.length}
      >
        {data?.result.map((r, i) => (
          <tr key={`${r.branchCode}-${r.userCode}-${r.punchTime}-${i}`} className="hover:bg-gold-soft/30">
            <td className="px-4 py-2.5 font-semibold text-brand">{time(r.punchTime)}</td>
            <td className="whitespace-nowrap px-4 py-2.5 text-gray-600">{branchName(r.branchCode)}</td>
            <td className="px-4 py-2.5 font-mono">{r.userCode}</td>
            <td className="px-4 py-2.5 font-mono">{r.employeeCode ?? "—"}</td>
            <td className="whitespace-nowrap px-4 py-2.5 font-medium">{r.fullName ?? <i className="text-gray-400">Chưa gán NV</i>}</td>
            <td className="px-4 py-2.5 text-gray-600">{r.departmentName ?? "—"}</td>
          </tr>
        ))}
      </DataTable>

      <Pager meta={data?.meta} onPage={setPage} truncated={truncated} />
    </div>
  );
}
