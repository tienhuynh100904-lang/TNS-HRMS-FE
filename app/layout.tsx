import type { Metadata } from "next";
import { Anton, Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "vietnamese"],
});

const anton = Anton({
  variable: "--font-anton",
  weight: "400",
  subsets: ["latin", "vietnamese"],
});

export const metadata: Metadata = {
  title: "TNS HRMS - Quản trị chấm công",
  description: "Hệ thống quản trị chấm công Thép Tây Nam",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="vi"
      className={`${inter.variable} ${anton.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
