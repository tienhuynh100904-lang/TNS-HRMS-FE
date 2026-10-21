"use client";

import { useState } from "react";
import type { Page, Permission, Role, RoleDetail } from "@/lib/api";
import { ADMIN_ROLE, api, query } from "@/lib/api";
import { Confirm, Listbox, Switch } from "../../controls";
import { type Column, DataTable, Field, input, Pager, useFetch } from "../../shared";
import { ActiveBadge, addButton, clean, dateTime, deleteButton, FormDrawer, MethodBadge, rowButton } from "../parts";

const ACTIVE = [
  { value: "", label: "Tất cả" },
  { value: "true", label: "Đang bật" },
  { value: "false", label: "Đã tắt" },
];

function filterOf(keyword: string, active: string) {
  const k = clean(keyword);
  return [active && `active:${active}`, k && `(name ~ '*${k}*' or description ~ '*${k}*')`].filter(Boolean).join(" and ");
}

// the names the backend sorts the role list on
const COLUMNS: Column[] = [
  { label: "Vai trò", field: "name" },
  { label: "Mô tả", field: "description" },
  { label: "Trạng thái", field: "active" },
  { label: "Cập nhật", field: "updatedAt" },
  "",
];

/** A checkbox that also shows "some" (indeterminate), for a whole module. */
function GroupCheckbox({ all, some, onChange, label }: { all: boolean; some: boolean; onChange: (on: boolean) => void; label: string }) {
  return (
    <input
      type="checkbox"
      aria-label={label}
      checked={all}
      ref={(el) => {
        if (el) el.indeterminate = some && !all;
      }}
      onChange={(e) => onChange(e.target.checked)}
      className="size-4 accent-brand"
    />
  );
}

/** Every permission grouped by module, each one a checkbox; a module's box selects all of it. */
function PermissionPicker({
  permissions,
  selected,
  onChange,
}: {
  permissions: Permission[];
  selected: number[];
  onChange: (ids: number[]) => void;
}) {
  const chosen = new Set(selected);
  const modules = new Map<string, Permission[]>();
  for (const p of [...permissions].sort((a, b) => a.module.localeCompare(b.module) || a.apiPath.localeCompare(b.apiPath) || a.method.localeCompare(b.method)))
    modules.set(p.module, [...(modules.get(p.module) ?? []), p]);

  const set = (ids: number[], on: boolean) => {
    const next = new Set(chosen);
    for (const id of ids) {
      if (on) next.add(id);
      else next.delete(id);
    }
    onChange([...next]);
  };

  if (!permissions.length) return <p className="text-sm text-gray-500">Chưa có quyền nào.</p>;
  return (
    <div className="divide-y divide-gray-100 rounded-lg border border-gray-200">
      {[...modules].map(([module, list]) => {
        const count = list.filter((p) => chosen.has(p.id)).length;
        return (
          <fieldset key={module}>
            <legend className="sr-only">Module {module}</legend>
            <label className="flex cursor-pointer items-center gap-3 bg-gold-soft/40 px-3 py-2">
              <GroupCheckbox
                label={`Chọn tất cả quyền của ${module}`}
                all={count === list.length}
                some={count > 0}
                onChange={(on) => set(list.map((p) => p.id), on)}
              />
              <span className="font-display text-sm uppercase tracking-wide text-brand-dark">{module}</span>
              <span className="ml-auto text-xs text-gray-500">
                {count}/{list.length}
              </span>
            </label>
            {list.map((p) => (
              <label key={p.id} className="flex cursor-pointer items-center gap-3 px-3 py-1.5 hover:bg-gold-soft/20">
                <input
                  type="checkbox"
                  checked={chosen.has(p.id)}
                  onChange={(e) => set([p.id], e.target.checked)}
                  className="size-4 shrink-0 accent-brand"
                />
                <MethodBadge method={p.method} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-mono text-xs">{p.apiPath}</span>
                  <span className="block text-xs text-gray-500">
                    {p.name}
                    {!p.active && <b className="ml-1 font-semibold text-gray-400">(đã tắt)</b>}
                  </span>
                </span>
              </label>
            ))}
          </fieldset>
        );
      })}
    </div>
  );
}

type Form = { name: string; description: string; active: boolean; permissions: number[] };

/**
 * Create a role (`role` undefined) or edit one with its permissions. The backend replaces the role's whole permission
 * list on save, so the full selection is always sent.
 */
function RoleDrawer({ role, onClose, onSaved }: { role?: Role; onClose: () => void; onSaved: () => void }) {
  const { data: detail, error: detailError } = useFetch<RoleDetail>(role ? `/api/v1/roles/${role.id}` : null);
  const { data: permissions, error: permissionsError } = useFetch<Permission[]>("/api/v1/permissions/all");
  // the form starts from the role as loaded, `edits` holds what the admin changed since
  const [edits, setEdits] = useState<Partial<Form>>({});
  const base: Form = {
    name: role?.name ?? "",
    description: role?.description ?? "",
    active: role?.active ?? true,
    permissions: detail?.permissions.map((p) => p.id) ?? [],
  };
  const form = { ...base, ...edits };
  const isAdmin = role?.name === ADMIN_ROLE;
  // every permission, once both lists needed for the form are loaded
  const ready = permissions && (!role || detail) ? permissions : null;
  const loadError = detailError || permissionsError;

  async function submit() {
    if (!ready) throw new Error("Đang tải dữ liệu, thử lại sau giây lát");
    const body = { name: form.name.trim(), description: form.description.trim(), active: form.active, permissions: form.permissions };
    if (role) await api("/api/v1/roles", { method: "PUT", body: JSON.stringify({ id: role.id, ...body }) });
    else await api("/api/v1/roles", { method: "POST", body: JSON.stringify(body) });
    onSaved();
  }

  return (
    <FormDrawer title={role ? `Sửa vai trò: ${role.name}` : "Thêm vai trò"} onClose={onClose} onSubmit={submit}>
      <Field label="Tên vai trò" hint={isAdmin ? "Vai trò ADMIN không đổi tên, không tắt và không xóa được." : undefined}>
        <input
          value={form.name}
          onChange={(e) => setEdits({ ...edits, name: e.target.value })}
          required
          maxLength={255}
          disabled={isAdmin}
          autoFocus={!role}
          placeholder="vd: HR_READONLY"
          className={`${input} font-mono ${isAdmin ? "bg-gray-50 text-gray-500" : ""}`}
        />
      </Field>
      <Field label="Mô tả">
        <input value={form.description} onChange={(e) => setEdits({ ...edits, description: e.target.value })} maxLength={255} className={input} />
      </Field>
      {!isAdmin && (
        <Switch
          label={form.active ? "Đang bật" : "Đã tắt: mọi client mang vai trò này bị chặn"}
          checked={form.active}
          onChange={(active) => setEdits({ ...edits, active })}
        />
      )}

      <div className="space-y-2">
        <div className="flex items-baseline justify-between">
          <h3 className="text-xs font-medium text-gray-600">Quyền gọi API</h3>
          {ready && !isAdmin && (
            <span className="text-xs text-gray-500">
              Đã chọn <b className="text-brand-dark">{form.permissions.length}</b>/{ready.length}
            </span>
          )}
        </div>
        {isAdmin ? (
          <p className="rounded-md bg-gold-soft/50 px-3 py-2 text-sm text-brand-dark">
            ADMIN được gọi <b>mọi</b> API mà không cần xét quyền, nên không cần chọn quyền cho vai trò này.
          </p>
        ) : loadError ? (
          <p className="text-sm text-red-600">{loadError}</p>
        ) : !ready ? (
          <p className="text-sm text-gray-500">Đang tải...</p>
        ) : (
          <PermissionPicker permissions={ready} selected={form.permissions} onChange={(ids) => setEdits({ ...edits, permissions: ids })} />
        )}
      </div>
    </FormDrawer>
  );
}

export default function RolesPage() {
  const [keyword, setKeyword] = useState("");
  const [search, setSearch] = useState("");
  const [active, setActive] = useState("");
  const [sort, setSort] = useState("");
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState<Role | "new" | null>(null);
  const [deleting, setDeleting] = useState<Role | null>(null);
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState("");

  const { data, error, loading, refresh } = useFetch<Page<Role>>(
    `/api/v1/roles?${query({ filter: filterOf(search, active), sort, page, size: 20 })}`,
  );

  async function remove(r: Role) {
    setRemoving(true);
    setRemoveError("");
    try {
      await api(`/api/v1/roles/${r.id}`, { method: "DELETE" });
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
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="max-w-3xl text-sm text-gray-600">
          Vai trò là tập các API được phép gọi. Mỗi client có một vai trò; đổi quyền của vai trò có hiệu lực ngay với mọi client
          mang vai trò đó.
        </p>
        <button onClick={() => setEditing("new")} className={addButton}>
          + Thêm vai trò
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
            placeholder="Tên hoặc mô tả vai trò"
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
        {data?.result.map((r) => (
          <tr key={r.id} className="hover:bg-gold-soft/30">
            <td className={`whitespace-nowrap px-4 py-2.5 font-mono font-semibold ${r.name === ADMIN_ROLE ? "text-brand" : ""}`}>{r.name}</td>
            <td className="px-4 py-2.5 text-gray-600">{r.description ?? "—"}</td>
            <td className="px-4 py-2.5">
              <ActiveBadge active={r.active} />
            </td>
            <td className="whitespace-nowrap px-4 py-2.5 text-gray-600">
              {dateTime(r.updatedAt ?? r.createdAt)}
              {(r.updatedBy || r.createdBy) && <span className="block text-xs text-gray-400">bởi {r.updatedBy || r.createdBy}</span>}
            </td>
            <td className="whitespace-nowrap px-4 py-2.5 text-right">
              <div className="flex items-center justify-end gap-1.5">
                <button onClick={() => setEditing(r)} className={rowButton}>
                  Sửa
                </button>
                {r.name !== ADMIN_ROLE && (
                  <button
                    onClick={() => {
                      setRemoveError("");
                      setDeleting(r);
                    }}
                    className={deleteButton}
                  >
                    Xóa
                  </button>
                )}
              </div>
            </td>
          </tr>
        ))}
      </DataTable>

      <Pager meta={data?.meta} onPage={setPage} />

      {editing && (
        <RoleDrawer
          role={editing === "new" ? undefined : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            refresh();
          }}
        />
      )}
      {deleting && (
        <Confirm
          title="Xóa vai trò"
          confirmLabel="Xóa"
          busy={removing}
          error={removeError}
          onConfirm={() => remove(deleting)}
          onCancel={() => setDeleting(null)}
        >
          Xóa vai trò <b className="font-mono">{deleting.name}</b>? Không hoàn tác được. Vai trò đang gán cho client nào thì không
          xóa được: hãy chuyển các client đó sang vai trò khác trước.
        </Confirm>
      )}
    </div>
  );
}
