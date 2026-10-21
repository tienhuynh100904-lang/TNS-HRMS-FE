"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/access/clients", label: "Client (ứng dụng)" },
  { href: "/access/roles", label: "Vai trò" },
  { href: "/access/permissions", label: "Quyền API" },
];

/** Who may call the API: clients (the applications), the role each one has, and the endpoints each role may call. */
export default function AccessLayout({ children }: LayoutProps<"/access">) {
  const pathname = usePathname();
  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-3xl uppercase tracking-wide text-brand-dark">Người dùng API</h1>
        <p className="text-sm text-gray-500">
          Các ứng dụng (backend khác, trang quản trị này) được phép gọi API, vai trò của từng ứng dụng và các API mà mỗi
          vai trò được gọi.
        </p>
      </div>
      <nav className="flex gap-1 border-b border-gray-200">
        {TABS.map((t) => {
          const current = pathname.startsWith(t.href);
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={current ? "page" : undefined}
              className={`-mb-px border-b-2 px-4 py-2 text-sm font-semibold transition ${
                current ? "border-brand text-brand" : "border-transparent text-gray-600 hover:border-gray-300 hover:text-brand-dark"
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>
      {children}
    </div>
  );
}
