"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { login } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setLoading(true);
    setError("");
    try {
      await login(String(form.get("email")), String(form.get("password")));
      router.replace("/attendance");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không kết nối được máy chủ");
      setLoading(false);
    }
  }

  return (
    <main className="flex flex-1 min-h-screen">
      <section className="hidden lg:flex flex-1 flex-col justify-between bg-gradient-to-br from-brand-dark via-brand to-brand-light p-12 text-white">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-white.svg" alt="Thép Tây Nam" className="h-16 w-auto self-start" />
        <div>
          <div className="mb-6 h-1.5 w-20 bg-gold" />
          <h1 className="font-display text-5xl uppercase leading-tight tracking-wide">
            Hệ thống <br />
            quản trị chấm công
          </h1>
          <p className="mt-4 max-w-md text-white/80">
            Theo dõi lượt quẹt thẻ và bảng công hằng ngày của toàn bộ chi nhánh Thép Tây Nam.
          </p>
        </div>
        <p className="text-sm text-white/60">© Tôn Tây Nam - TNS HRMS</p>
      </section>

      <section className="flex flex-1 items-center justify-center p-6">
        <form onSubmit={onSubmit} className="w-full max-w-sm space-y-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="Thép Tây Nam" className="h-14 w-auto lg:hidden" />
          <div>
            <h2 className="font-display text-3xl uppercase tracking-wide text-brand-dark">Đăng nhập</h2>
            <p className="mt-1 text-sm text-gray-500">Dùng tài khoản được quản trị viên cấp.</p>
          </div>

          <label className="block">
            <span className="text-sm font-medium text-gray-700">Email</span>
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2.5 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-gray-700">Mật khẩu</span>
            <input
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2.5 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
            />
          </label>

          {error && (
            <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <button
            disabled={loading}
            className="w-full rounded-md bg-brand py-2.5 font-semibold text-white shadow-sm transition hover:bg-brand-dark disabled:opacity-60"
          >
            {loading ? "Đang đăng nhập..." : "Đăng nhập"}
          </button>
        </form>
      </section>
    </main>
  );
}
