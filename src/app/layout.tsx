import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Playerok Bot — автоматизация продаж",
  description:
    "Авто-выдача, авто-поднятие, восстановление товаров, авто-подтверждение сделок и ИИ-автоответчик для Playerok.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru">
      <body className="min-h-screen bg-slate-950 text-slate-200 antialiased">{children}</body>
    </html>
  );
}
