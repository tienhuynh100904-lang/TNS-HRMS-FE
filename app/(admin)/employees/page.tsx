"use client";

import { useState } from "react";
import type { Employee, EmployeePunch, Page } from "@/lib/api";
import { api, query } from "@/lib/api";
import { ariaSort, Confirm, Drawer, Listbox, MonthPicker, SortButton, Switch } from "../controls";
import { branchName, type Column, DataTable, input, Pager, time, useFetch } from "../shared";

const ACTIVE = [
  { value: "", label: "Tất cả" },
  { value: "true", label: "Đang làm việc" },
  { value: "false", label: "Đã nghỉ việc" },
];

// spring-filter has no escape for these inside a quoted value, so they are dropped from what the user typed
const clean = (keyword: string) => keyword.replace(/['\\*]/g, "").trim();

function filterOf(keyword: string, active: string) {
  const k = clean(keyword);
  return [
    active && `active:${active}`,
    k && `(fullName ~ '*${k}*' or employeeCode ~ '*${k}*' or userCode ~ '*${k}*')`,
  ]
    .filter(Boolean)
    .join(" and ");
}

// the names the backend sorts the employee list on
const COLUMNS: Column[] = [
  { label: "Mã NV", field: "employeeCode" },
  { label: "Mã CC", field: "userCode" },
  { label: "Mã thẻ", field: "cardCode" },
  { label: "Họ tên", field: "fullName" },
  { label: "Phòng ban", field: "department.name" },
  { label: "Trạng thái", field: "active" },
  "",
];

const name = (e: Employee) => e.fullName ?? e.employeeCode ?? `#${e.id}`;

const pad = (n: number) => String(n).padStart(2, "0");
const DAY_NAMES = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

/** Every punch of one employee in one month, grouped by day, in a side panel. */
function PunchesDrawer({ employee, onClose }: { employee: Employee; onClose: () => void }) {
  // mounted by a click, so reading the current month here is safe (nothing of it is prerendered)
  const [ym, setYm] = useState(() => new Date().toLocaleDateString("sv-SE").slice(0, 7));
  const [sort, setSort] = useState(""); // the backend only sorts punches by time; none = oldest first
  const [y, m] = ym.split("-").map(Number);
  const shift = (n: number) => setYm(new Date(y, m - 1 + n, 1).toLocaleDateString("sv-SE").slice(0, 7));

  const last = new Date(y, m, 0).getDate();
  const url = `/api/v1/attendance/monthly?${query({
    employeeId: employee.id,
    from: `${y}-${pad(m)}-01`,
    to: `${y}-${pad(m)}-${pad(last)}`,
    sort: sort && "punchTime," + sort.split(",")[1],
    size: 2000, // Spring's max page size, a month has far fewer
  })}`;
  const { data, error, loading } = useFetch<Page<EmployeePunch>>(url);

  const days = new Map<string, EmployeePunch[]>();
  for (const p of data?.result ?? []) {
    const day = p.punchTime.slice(0, 10);
    days.set(day, [...(days.get(day) ?? []), p]);
  }

  const nav = "rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:border-brand hover:text-brand";
  return (
    <Drawer title={name(employee)} onClose={onClose}>
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-5 py-3">
        <p className="text-sm text-gray-600">
          Mã NV <b className="font-mono text-gray-900">{employee.employeeCode}</b> · Mã CC{" "}
          <b className="font-mono text-gray-900">{employee.userCode}</b>
          {employee.departmentName && <> · {employee.departmentName}</>}
        </p>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => shift(-1)} className={nav} aria-label="Tháng trước">
            ‹
          </button>
          <MonthPicker value={ym} onChange={setYm} />
          <button type="button" onClick={() => shift(1)} className={nav} aria-label="Tháng sau">
            ›
          </button>
        </div>
      </div>

      <div className={`min-h-0 flex-1 overflow-auto overscroll-contain ${loading ? "opacity-60" : ""}`}>
        {error ? (
          <p className="px-5 py-10 text-center text-red-600">{error}</p>
        ) : !days.size ? (
          <p className="px-5 py-10 text-center text-gray-500">
            {loading ? "Đang tải..." : "Không có lượt quẹt nào trong tháng này."}
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-gold-soft text-left text-xs uppercase tracking-wide text-brand-dark">
              <tr>
                <th aria-sort={ariaSort(sort, "day")} className="px-5 py-2 font-semibold">
                  <SortButton label="Ngày" field="day" sort={sort} onSort={setSort} />
                </th>
                <th className="px-3 py-2 font-semibold">Các lần quẹt</th>
                <th className="px-3 py-2 text-center font-semibold">Số lượt</th>
                <th className="px-5 py-2 font-semibold">Chi nhánh</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {[...days].map(([day, punches]) => {
                const dow = new Date(y, m - 1, Number(day.slice(8))).getDay();
                const branches = [...new Set(punches.map((p) => branchName(p.branchCode)))];
                return (
                  <tr key={day} className="align-top hover:bg-gold-soft/30">
                    <td className="whitespace-nowrap px-5 py-2.5 font-semibold">
                      {day.slice(8)}/{day.slice(5, 7)}{" "}
                      <span className={dow === 0 ? "font-normal text-brand" : "font-normal text-gray-500"}>
                        {DAY_NAMES[dow]}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 font-mono">{punches.map((p) => time(p.punchTime)).join(" · ")}</td>
                    <td className="px-3 py-2.5 text-center">{punches.length}</td>
                    <td className="px-5 py-2.5 text-gray-600">{branches.join(", ")}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <p className="shrink-0 border-t border-gray-100 px-5 py-2.5 text-sm text-gray-600">
        Tháng này: <b className="text-brand-dark">{data?.meta.total ?? 0}</b> lượt quẹt trong{" "}
        <b className="text-brand-dark">{days.size}</b> ngày.
      </p>
    </Drawer>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-gray-600">
      {label}
      {children}
      {hint && <span className="font-normal text-gray-500">{hint}</span>}
    </label>
  );
}

/** Edit one employee. The backend replaces the whole employee, so every field is sent, the department as it is. */
function EditDrawer({ employee, onClose, onSaved }: { employee: Employee; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    employeeCode: employee.employeeCode ?? "",
    userCode: employee.userCode ?? "",
    cardCode: employee.cardCode ?? "",
    fullName: employee.fullName ?? "",
    active: employee.active,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const text = (key: "employeeCode" | "userCode" | "cardCode" | "fullName", max: number) => ({
    value: form[key],
    maxLength: max,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [key]: e.target.value }),
    className: input,
  });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await api("/api/v1/employees", {
        method: "PUT",
        body: JSON.stringify({ id: employee.id, departmentId: employee.departmentId, ...form }),
      });
      onSaved();
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  }

  return (
    <Drawer title={`Sửa: ${name(employee)}`} onClose={onClose}>
      <form onSubmit={save} className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 space-y-4 overflow-auto overscroll-contain p-5">
          {error && (
            <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}
          <Field label="Họ tên">
            <input {...text("fullName", 255)} autoFocus />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Mã nhân viên">
              <input {...text("employeeCode", 20)} />
            </Field>
            <Field label="Mã thẻ">
              <input {...text("cardCode", 20)} />
            </Field>
          </div>
          <Field
            label="Mã chấm công"
            hint="Lượt quẹt thẻ gắn với mã này: đổi mã thì lượt quẹt hiển thị của người này cũng đổi theo."
          >
            <input {...text("userCode", 20)} />
          </Field>
          <Field label="Phòng ban" hint="Chưa sửa được ở đây, giữ nguyên như hiện tại.">
            <input value={employee.departmentName ?? "—"} readOnly disabled className={`${input} bg-gray-50 text-gray-500`} />
          </Field>
          <Switch
            label={form.active ? "Đang làm việc" : "Đã nghỉ việc"}
            checked={form.active}
            onChange={(active) => setForm({ ...form, active })}
          />
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
            {saving ? "Đang lưu..." : "Lưu"}
          </button>
        </div>
      </form>
    </Drawer>
  );
}

export default function EmployeesPage() {
  const [keyword, setKeyword] = useState("");
  const [search, setSearch] = useState("");
  const [active, setActive] = useState("");
  const [sort, setSort] = useState("");
  const [page, setPage] = useState(0);
  const [viewing, setViewing] = useState<Employee | null>(null);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [deleting, setDeleting] = useState<Employee | null>(null);
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState("");

  const { data, error, loading, refresh } = useFetch<Page<Employee>>(
    `/api/v1/employees?${query({ filter: filterOf(search, active), sort, page, size: 20 })}`,
  );

  async function remove(e: Employee) {
    setRemoving(true);
    setRemoveError("");
    try {
      await api(`/api/v1/employees/${e.id}`, { method: "DELETE" });
      setDeleting(null);
      // that was the last row of the last page: the page is gone, go back one
      if (data?.result.length === 1 && page > 0) setPage(page - 1);
      else refresh();
    } catch (err) {
      setRemoveError((err as Error).message);
    } finally {
      setRemoving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-3xl uppercase tracking-wide text-brand-dark">Nhân viên</h1>
        <p className="text-sm text-gray-500">
          Toàn bộ người dùng trong hệ thống. Xem lượt quẹt thẻ theo tháng, sửa hoặc xóa từng người.
        </p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setSearch(keyword);
          setPage(0);
        }}
        className="flex flex-wrap items-end gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
      >
        <Listbox
          label="Trạng thái"
          value={active}
          options={ACTIVE}
          onChange={(v) => {
            setActive(v);
            setPage(0);
          }}
          className="min-w-44"
        />
        <label className="flex min-w-56 flex-1 flex-col gap-1 text-xs font-medium text-gray-600">
          Tìm kiếm
          <input
            type="search"
            placeholder="Mã nhân viên, mã chấm công hoặc họ tên"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            className={input}
          />
        </label>
        <button className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark">Tìm</button>
      </form>

      <DataTable
        head={COLUMNS}
        sort={sort}
        onSort={(s) => {
          setSort(s);
          setPage(0);
        }}
        loading={loading}
        error={error}
        empty={!data?.result.length}
      >
        {data?.result.map((e) => (
          <tr key={e.id} className="hover:bg-gold-soft/30">
            <td className="px-4 py-2.5 font-mono">{e.employeeCode}</td>
            <td className="px-4 py-2.5 font-mono">{e.userCode ?? "—"}</td>
            <td className="px-4 py-2.5 font-mono">{e.cardCode ?? "—"}</td>
            <td className="whitespace-nowrap px-4 py-2.5 font-medium">{e.fullName ?? <i className="font-normal text-gray-400">Chưa có tên</i>}</td>
            <td className="px-4 py-2.5 text-gray-600">{e.departmentName ?? "—"}</td>
            <td className="px-4 py-2.5">
              <span
                className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  e.active ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"
                }`}
              >
                {e.active ? "Đang làm việc" : "Đã nghỉ việc"}
              </span>
            </td>
            <td className="whitespace-nowrap px-4 py-2.5 text-right">
              <div className="flex items-center justify-end gap-1.5">
                {e.userCode ? (
                  <button
                    onClick={() => setViewing(e)}
                    className="rounded-md border border-brand px-3 py-1 text-sm font-semibold text-brand hover:bg-brand hover:text-white"
                  >
                    Lượt quẹt
                  </button>
                ) : (
                  <i className="mr-1 text-xs text-gray-400">Chưa có mã CC</i>
                )}
                <button
                  onClick={() => setEditing(e)}
                  className="rounded-md border border-gray-300 px-3 py-1 text-sm font-medium hover:border-brand hover:text-brand"
                >
                  Sửa
                </button>
                <button
                  onClick={() => {
                    setRemoveError("");
                    setDeleting(e);
                  }}
                  className="rounded-md border border-gray-300 px-3 py-1 text-sm font-medium text-gray-700 hover:border-red-600 hover:bg-red-600 hover:text-white"
                >
                  Xóa
                </button>
              </div>
            </td>
          </tr>
        ))}
      </DataTable>

      <Pager meta={data?.meta} onPage={setPage} />

      {viewing && <PunchesDrawer employee={viewing} onClose={() => setViewing(null)} />}
      {editing && (
        <EditDrawer
          employee={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            refresh();
          }}
        />
      )}
      {deleting && (
        <Confirm
          title="Xóa nhân viên"
          confirmLabel="Xóa"
          busy={removing}
          error={removeError}
          onConfirm={() => remove(deleting)}
          onCancel={() => setDeleting(null)}
        >
          Xóa <b>{name(deleting)}</b>
          {deleting.employeeCode && <> (Mã NV {deleting.employeeCode})</>}? Không hoàn tác được. Các lượt quẹt thẻ vẫn được
          giữ lại, vì chúng gắn với mã chấm công chứ không gắn với nhân viên.
        </Confirm>
      )}
    </div>
  );
}
