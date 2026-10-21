"use client";

import { useState } from "react";
import type { Page, Permission } from "@/lib/api";
import { api, query } from "@/lib/api";
import { Confirm, Listbox, Switch } from "../../controls";
import { type Column, DataTable, Field, input, Pager, useFetch } from "../../shared";
import { ActiveBadge, addButton, clean, deleteButton, FormDrawer, METHODS, MethodBadge, rowButton } from "../parts";

const ACTIVE = [
  { value: "", label: "Tất cả" },
  { value: "true", label: "Đang bật" },
  { value: "false", label: "Đã tắt" },
];

function filterOf(keyword: string, method: string, active: string) {
  const k = clean(keyword);
  return [
    active && `active:${active}`,
    method && `method:'${method}'`,
    k && `(name ~ '*${k}*' or apiPath ~ '*${k}*')`,
  ]
    .filter(Boolean)
    .join(" and ");
}

// the names the backend sorts the permission list on
const COLUMNS: Column[] = [
  { label: "Method", field: "method" },
  { label: "Đường dẫn API", field: "apiPath" },
  { label: "Tên", field: "name" },
  { label: "Module", field: "module" },
  { label: "Trạng thái", field: "active" },
  "",
];

/** Create a permission (`permission` undefined) or edit one. The backend replaces every field, `active` included. */
function PermissionDrawer({
  permission,
  modules,
  onClose,
  onSaved,
}: {
  permission?: Permission;
  modules: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    name: permission?.name ?? "",
    apiPath: permission?.apiPath ?? "/api/v1/",
    method: permission?.method ?? "GET",
    module: permission?.module ?? "",
    active: permission?.active ?? true,
  });
  const text = (key: "name" | "apiPath" | "module") => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [key]: e.target.value }),
    className: input,
  });

  async function submit() {
    const body = { ...form, name: form.name.trim(), apiPath: form.apiPath.trim(), module: form.module.trim().toUpperCase() };
    if (permission) await api("/api/v1/permissions", { method: "PUT", body: JSON.stringify({ id: permission.id, ...body }) });
    else await api("/api/v1/permissions", { method: "POST", body: JSON.stringify(body) });
    onSaved();
  }

  return (
    <FormDrawer title={permission ? `Sửa quyền: ${permission.name}` : "Thêm quyền"} onClose={onClose} onSubmit={submit}>
      <p className="rounded-md bg-gold-soft/50 px-3 py-2 text-sm text-brand-dark">
        Một quyền là một cặp <b>method + đường dẫn</b> của đúng một endpoint. Đường dẫn phải trùng <b>mẫu</b> khai báo ở backend
        (giữ nguyên biến dạng <code className="font-mono">{"{id}"}</code>), nếu không quyền sẽ không bao giờ khớp.
      </p>
      <Field label="Tên">
        <input {...text("name")} required maxLength={255} autoFocus placeholder="vd: Get Daily Attendance" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-[9rem_1fr]">
        <Listbox
          label="Method"
          value={form.method}
          options={METHODS.map((m) => ({ value: m, label: m }))}
          onChange={(method) => setForm({ ...form, method })}
        />
        <Field label="Đường dẫn API">
          <input
            {...text("apiPath")}
            required
            maxLength={255}
            pattern="/.*"
            title="Bắt đầu bằng /"
            spellCheck={false}
            placeholder="/api/v1/clients/{id}"
            className={`${input} font-mono`}
          />
        </Field>
      </div>
      <Field label="Module" hint="Nhóm quyền để dễ chọn khi gán cho vai trò. Chọn module có sẵn hoặc gõ tên mới.">
        <input {...text("module")} required maxLength={255} list="permission-modules" autoCapitalize="characters" className={`${input} uppercase`} />
        <datalist id="permission-modules">
          {modules.map((m) => (
            <option key={m} value={m} />
          ))}
        </datalist>
      </Field>
      <Switch
        label={form.active ? "Đang bật" : "Đã tắt: không vai trò nào dùng được quyền này"}
        checked={form.active}
        onChange={(active) => setForm({ ...form, active })}
      />
    </FormDrawer>
  );
}

export default function PermissionsPage() {
  const [keyword, setKeyword] = useState("");
  const [search, setSearch] = useState("");
  const [module, setModule] = useState("");
  const [method, setMethod] = useState("");
  const [active, setActive] = useState("");
  const [sort, setSort] = useState("");
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState<Permission | "new" | null>(null);
  const [deleting, setDeleting] = useState<Permission | null>(null);
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState("");

  const { data, error, loading, refresh } = useFetch<Page<Permission>>(
    `/api/v1/permissions?${query({ filter: filterOf(search, method, active), module, sort, page, size: 20 })}`,
  );
  const { data: modules, refresh: refreshModules } = useFetch<string[]>("/api/v1/permissions/modules");

  const reset = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setPage(0);
  };

  async function remove(p: Permission) {
    setRemoving(true);
    setRemoveError("");
    try {
      await api(`/api/v1/permissions/${p.id}`, { method: "DELETE" });
      setDeleting(null);
      refreshModules();
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
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="max-w-3xl text-sm text-gray-600">
          Mỗi quyền cho phép gọi một endpoint. Quyền của các API có sẵn do backend tự tạo khi khởi động (tên và module của chúng
          được đặt lại mỗi lần khởi động); chỉ cần thêm tay khi backend có endpoint mới chưa được khai báo.
        </p>
        <button onClick={() => setEditing("new")} className={addButton}>
          + Thêm quyền
        </button>
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
          label="Module"
          value={module}
          options={[{ value: "", label: "Tất cả module" }, ...(modules ?? []).map((m) => ({ value: m, label: m }))]}
          onChange={reset(setModule)}
          className="min-w-44"
        />
        <Listbox
          label="Method"
          value={method}
          options={[{ value: "", label: "Tất cả" }, ...METHODS.map((m) => ({ value: m, label: m }))]}
          onChange={reset(setMethod)}
          className="min-w-32"
        />
        <Listbox label="Trạng thái" value={active} options={ACTIVE} onChange={reset(setActive)} className="min-w-36" />
        <label className="flex min-w-56 flex-1 flex-col gap-1 text-xs font-medium text-gray-600">
          Tìm kiếm
          <input
            type="search"
            placeholder="Tên hoặc đường dẫn API"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            className={input}
          />
        </label>
        <button className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark">Tìm</button>
      </form>

      <DataTable head={COLUMNS} sort={sort} onSort={reset(setSort)} loading={loading} error={error} empty={!data?.result.length}>
        {data?.result.map((p) => (
          <tr key={p.id} className="hover:bg-gold-soft/30">
            <td className="px-4 py-2.5">
              <MethodBadge method={p.method} />
            </td>
            <td className="px-4 py-2.5 font-mono text-xs">{p.apiPath}</td>
            <td className="px-4 py-2.5 font-medium">{p.name}</td>
            <td className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-gray-600">{p.module}</td>
            <td className="px-4 py-2.5">
              <ActiveBadge active={p.active} />
            </td>
            <td className="whitespace-nowrap px-4 py-2.5 text-right">
              <div className="flex items-center justify-end gap-1.5">
                <button onClick={() => setEditing(p)} className={rowButton}>
                  Sửa
                </button>
                <button
                  onClick={() => {
                    setRemoveError("");
                    setDeleting(p);
                  }}
                  className={deleteButton}
                >
                  Xóa
                </button>
              </div>
            </td>
          </tr>
        ))}
      </DataTable>

      <Pager meta={data?.meta} onPage={setPage} />

      {editing && (
        <PermissionDrawer
          permission={editing === "new" ? undefined : editing}
          modules={modules ?? []}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            refresh();
            refreshModules();
          }}
        />
      )}
      {deleting && (
        <Confirm
          title="Xóa quyền"
          confirmLabel="Xóa"
          busy={removing}
          error={removeError}
          onConfirm={() => remove(deleting)}
          onCancel={() => setDeleting(null)}
        >
          Xóa quyền <b>{deleting.name}</b> (<span className="font-mono">{deleting.method} {deleting.apiPath}</span>)? Quyền bị gỡ
          khỏi mọi vai trò đang có nó. Nếu đây là quyền của API có sẵn, backend sẽ tạo lại ở lần khởi động sau nhưng không gán lại
          cho các vai trò đó. Muốn tạm chặn, hãy <b>tắt</b> quyền thay vì xóa.
        </Confirm>
      )}
    </div>
  );
}
