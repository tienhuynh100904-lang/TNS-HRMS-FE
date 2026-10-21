"use client";

import { useState, useSyncExternalStore } from "react";
import type { ApiClient, ApiClientWithSecret, Page, Role } from "@/lib/api";
import { ADMIN_ROLE, api, getSession, query, rememberSecret } from "@/lib/api";
import { Confirm, Listbox, Switch } from "../../controls";
import { type Column, DataTable, Field, input, Pager, useFetch } from "../../shared";
import { ActiveBadge, addButton, dateTime, FormDrawer, rowButton, SecretDialog } from "../parts";

// the names the backend sorts the client list on (it has no filter)
const COLUMNS: Column[] = [
  { label: "Client ID", field: "clientId" },
  { label: "Tên", field: "name" },
  { label: "Vai trò", field: "role.name" },
  { label: "Trạng thái", field: "active" },
  { label: "Tạo lúc", field: "createdAt" },
  "",
];

const noSubscribe = () => () => {};
// the client logged in here, read in the browser only (localStorage)
const useCurrentClientId = () => useSyncExternalStore(noSubscribe, () => getSession()?.clientId ?? "", () => "");

/** Create a client (`client` undefined) or edit one. Creating answers with the secret, shown once by the page. */
function ClientDrawer({
  client,
  roles,
  self,
  onClose,
  onSaved,
}: {
  client?: ApiClient;
  roles: Role[];
  self: boolean;
  onClose: () => void;
  onSaved: (created?: ApiClientWithSecret) => void;
}) {
  const current = roles.find((r) => r.name === client?.role);
  const [form, setForm] = useState({
    clientId: client?.clientId ?? "",
    name: client?.name ?? "",
    description: client?.description ?? "",
    roleId: current ? String(current.id) : "",
    active: client?.active ?? true,
  });
  // the backend only assigns active roles; the client's own role stays listed (marked) even when it was turned off
  const options = [
    { value: "", label: "— Chọn vai trò —" },
    ...roles
      .filter((r) => r.active || r.id === current?.id)
      .map((r) => ({ value: String(r.id), label: r.active ? r.name : `${r.name} (đã tắt)` })),
  ];
  const text = (key: "clientId" | "name" | "description") => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [key]: e.target.value }),
    className: input,
  });

  async function submit() {
    if (!form.roleId) throw new Error("Chọn vai trò cho client");
    const body = { name: form.name.trim(), description: form.description.trim(), roleId: Number(form.roleId), active: form.active };
    if (client) {
      await api("/api/v1/clients", { method: "PUT", body: JSON.stringify({ id: client.id, ...body }) });
      onSaved();
    } else {
      const created = await api<ApiClientWithSecret>("/api/v1/clients", {
        method: "POST",
        body: JSON.stringify({ clientId: form.clientId.trim(), ...body }),
      });
      onSaved(created);
    }
  }

  return (
    <FormDrawer
      title={client ? `Sửa: ${client.clientId}` : "Thêm client"}
      submitLabel={client ? "Lưu" : "Tạo client"}
      onClose={onClose}
      onSubmit={submit}
    >
      {self && (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Đây là client bạn đang đăng nhập: tắt nó hoặc đổi sang vai trò ít quyền hơn sẽ làm bạn mất quyền ngay.
        </p>
      )}
      <Field
        label="Client ID"
        hint={client ? "Không đổi được sau khi tạo." : "3–100 ký tự: chữ, số, dấu chấm, gạch dưới, gạch ngang. Không đổi được sau khi tạo."}
      >
        {client ? (
          <input value={client.clientId} readOnly disabled className={`${input} bg-gray-50 font-mono text-gray-500`} />
        ) : (
          <input
            {...text("clientId")}
            required
            minLength={3}
            maxLength={100}
            pattern="[A-Za-z0-9._\-]+"
            title="Chỉ chữ, số, dấu chấm, gạch dưới và gạch ngang"
            autoCapitalize="none"
            spellCheck={false}
            autoFocus
            placeholder="vd: erp-backend"
            className={`${input} font-mono`}
          />
        )}
      </Field>
      <Field label="Tên" hint="Tên ứng dụng dùng client này, để dễ nhận ra.">
        <input {...text("name")} required maxLength={255} autoFocus={!!client} />
      </Field>
      <Field label="Mô tả">
        <input {...text("description")} maxLength={255} />
      </Field>
      <Listbox label="Vai trò" value={form.roleId} options={options} onChange={(roleId) => setForm({ ...form, roleId })} />
      <Switch
        label={form.active ? "Đang bật: được lấy token và gọi API" : "Đã khóa: bị chặn ngay, kể cả token đang dùng"}
        checked={form.active}
        onChange={(active) => setForm({ ...form, active })}
      />
      {!client && (
        <p className="text-sm text-gray-500">
          Secret do máy chủ tự sinh và chỉ hiện <b>một lần</b> ngay sau khi tạo.
        </p>
      )}
    </FormDrawer>
  );
}

export default function ClientsPage() {
  const self = useCurrentClientId();
  const [sort, setSort] = useState("");
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState<ApiClient | "new" | null>(null);
  const [rotating, setRotating] = useState<ApiClient | null>(null);
  const [busy, setBusy] = useState(false);
  const [rotateError, setRotateError] = useState("");
  const [secret, setSecret] = useState<ApiClientWithSecret | null>(null);

  const { data, error, loading, refresh } = useFetch<Page<ApiClient>>(`/api/v1/clients?${query({ sort, page, size: 20 })}`);
  // every role, for the role picker (Spring's max page size, there are only a handful)
  const { data: roles } = useFetch<Page<Role>>(`/api/v1/roles?${query({ sort: "name,asc", size: 2000 })}`);

  async function rotate(c: ApiClient) {
    setBusy(true);
    setRotateError("");
    try {
      const renewed = await api<ApiClientWithSecret>(`/api/v1/clients/${c.id}/secret`, { method: "POST" });
      rememberSecret(renewed.clientId, renewed.clientSecret);
      setRotating(null);
      setSecret(renewed);
    } catch (err) {
      setRotateError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="max-w-3xl text-sm text-gray-600">
          Mỗi ứng dụng gọi API bằng một client (Client ID + Secret) và được phép gọi các API theo vai trò của client đó. Khóa
          client sẽ chặn ngay, kể cả token chưa hết hạn.
        </p>
        <button onClick={() => setEditing("new")} disabled={!roles} className={`${addButton} disabled:opacity-60`}>
          + Thêm client
        </button>
      </div>

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
        {data?.result.map((c) => (
          <tr key={c.id} className="hover:bg-gold-soft/30">
            <td className="whitespace-nowrap px-4 py-2.5 font-mono font-medium">
              {c.clientId}
              {c.clientId === self && (
                <span className="ml-2 rounded bg-gold-soft px-1.5 py-0.5 font-sans text-[11px] font-semibold text-brand-dark">Bạn</span>
              )}
            </td>
            <td className="px-4 py-2.5">
              <span className="block font-medium">{c.name ?? "—"}</span>
              {c.description && <span className="block text-xs text-gray-500">{c.description}</span>}
            </td>
            <td className="px-4 py-2.5">
              <span className={`font-mono text-xs font-semibold ${c.role === ADMIN_ROLE ? "text-brand" : "text-gray-700"}`}>
                {c.role ?? "—"}
              </span>
            </td>
            <td className="px-4 py-2.5">
              <ActiveBadge active={c.active} on="Đang bật" off="Đã khóa" />
            </td>
            <td className="whitespace-nowrap px-4 py-2.5 text-gray-600">
              {dateTime(c.createdAt)}
              {c.createdBy && <span className="block text-xs text-gray-400">bởi {c.createdBy}</span>}
            </td>
            <td className="whitespace-nowrap px-4 py-2.5 text-right">
              <div className="flex items-center justify-end gap-1.5">
                <button onClick={() => setEditing(c)} disabled={!roles} className={`${rowButton} disabled:opacity-50`}>
                  Sửa
                </button>
                <button
                  onClick={() => {
                    setRotateError("");
                    setRotating(c);
                  }}
                  className={rowButton}
                >
                  Đổi secret
                </button>
              </div>
            </td>
          </tr>
        ))}
      </DataTable>

      <Pager meta={data?.meta} onPage={setPage} />

      {editing && roles && (
        <ClientDrawer
          client={editing === "new" ? undefined : editing}
          roles={roles.result}
          self={editing !== "new" && editing.clientId === self}
          onClose={() => setEditing(null)}
          onSaved={(created) => {
            setEditing(null);
            if (created) setSecret(created);
            refresh();
          }}
        />
      )}
      {rotating && (
        <Confirm
          title="Đổi secret"
          confirmLabel="Đổi secret"
          busy={busy}
          error={rotateError}
          onConfirm={() => rotate(rotating)}
          onCancel={() => setRotating(null)}
        >
          Tạo secret mới cho <b className="font-mono">{rotating.clientId}</b>? Secret cũ <b>ngừng hoạt động ngay</b>: ứng dụng
          đang dùng client này sẽ không lấy được token mới cho tới khi được cập nhật secret mới.
          {rotating.clientId === self && <> Đây là client bạn đang đăng nhập: phiên hiện tại vẫn dùng tiếp, lần đăng nhập sau dùng secret mới.</>}
        </Confirm>
      )}
      {secret && <SecretDialog clientId={secret.clientId} secret={secret.clientSecret} onClose={() => setSecret(null)} />}
    </div>
  );
}
