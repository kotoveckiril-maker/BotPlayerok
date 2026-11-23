import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "BotPlayerok — автоматизация продаж",
    template: "%s · BotPlayerok",
  },
  description:
    "Авто-выдача, авто-поднятие, восстановление товаров, авто-подтверждение сделок, ИИ-автоответчик и живая статистика для Playerok.",
  robots: { index: false, follow: false },
  icons: { icon: "/favicon.svg" },
};

export const viewport: Viewport = {
  themeColor: "#020617",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru">
      <body className="min-h-screen bg-slate-950 text-slate-200 antialiased">
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(ellipse_at_top,rgba(99,102,241,0.13),transparent_55%)]"
        />
        <div className="relative z-10">{children}</div>
      </body>
    </html>
  );
}
