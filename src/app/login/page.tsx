"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(json.error ?? `Ошибка ${res.status}`);
        return;
      }
      router.replace("/");
      router.refresh();
    } catch {
      setError("Не удалось подключиться к серверу");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-2xl shadow-lg shadow-indigo-500/20">
            🤖
          </div>
          <div>
            <div className="text-lg font-semibold text-white">BotPlayerok</div>
            <div className="text-xs text-slate-400">панель управления</div>
          </div>
        </div>

        <form
          onSubmit={submit}
          className="rounded-2xl border border-white/10 bg-slate-900/80 p-6 shadow-2xl backdrop-blur"
        >
          <h1 className="text-lg font-semibold text-white">Вход в админку</h1>
          <p className="mt-1 text-sm text-slate-400">
            Введите пароль. Если вы не задавали его — сгенерированный пароль указан в логах
            сервера при первом запуске.
          </p>

          <label className="mt-5 block">
            <span className="mb-1 block text-xs font-medium text-slate-300">Пароль</span>
            <input
              autoFocus
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-slate-950/70 px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:border-indigo-400 focus:outline-none"
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </label>

          {error && (
            <div className="mt-3 rounded-lg border border-rose-400/30 bg-rose-400/10 px-3 py-2 text-sm text-rose-200">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={busy || !password}
            className="mt-5 w-full rounded-lg bg-indigo-500 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? "Проверяем…" : "Войти"}
          </button>

          <p className="mt-4 text-center text-xs text-slate-500">
            Пароль можно сменить в разделе «Настройки → Безопасность».
          </p>
        </form>
      </div>
    </div>
  );
}
