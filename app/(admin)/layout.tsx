"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";
import { getSession, getToken, logout, watchSession } from "@/lib/api";

const NAV = [
  { href: "/attendance", label: "Bảng công ngày" },
  { href: "/punches", label: "Lượt quẹt thẻ" },
  { href: "/employees", label: "Nhân viên" },
  { href: "/access/clients", match: "/access", label: "Người dùng API" },
];

const noSubscribe = () => () => {};

export default function AdminLayout({ children }: LayoutProps<"/">) {
  const router = useRouter();
  const pathname = usePathname();
  // The token is in localStorage, so it is only known in the browser (null on the server): nothing renders without it.
  const token = useSyncExternalStore(noSubscribe, getToken, () => null);
  const session = token ? getSession() : null;

  useEffect(() => {
    if (getToken()) watchSession();
    else router.replace("/login");
  }, [router]);

  // children render even without a token: a segment that renders nothing on the server is "dropped" and fails
  // Next's instant-navigation validation. Without a token the effect above sends the user to /login.
  return (
    <div className="flex flex-1 flex-col">
      {session && (
        <header className="bg-brand-dark text-white shadow">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-8 gap-y-2 px-4 py-3">
            <Link href="/attendance" className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/logo-white.svg"
                alt="Thép Tây Nam"
                className="h-10 w-auto"
              />
              <span className="hidden border-l border-white/30 pl-3 font-display text-lg uppercase tracking-wide sm:block">
                Quản trị chấm công
              </span>
            </Link>
            <nav className="flex gap-1">
              {NAV.map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  className={`rounded-md px-3 py-2 text-sm font-medium transition ${
                    pathname.startsWith(n.match ?? n.href)
                      ? "bg-gold text-brand-dark"
                      : "text-white/85 hover:bg-white/10"
                  }`}
                >
                  {n.label}
                </Link>
              ))}
            </nav>
            <div className="ml-auto flex items-center gap-3 text-sm">
              <span className="hidden font-medium md:block">
                {session.clientId}
              </span>
              <button
                onClick={logout}
                className="rounded-md border border-white/40 px-3 py-1.5 hover:bg-white/10"
              >
                Đăng xuất
              </button>
            </div>
          </div>
          <div className="h-1 bg-gold" />
        </header>
      )}
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">
        {children}
      </main>
    </div>
  );
}
