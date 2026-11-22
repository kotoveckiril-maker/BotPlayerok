import { PlayerokClient, PlayerokError } from "@/lib/playerok/client";
import { runAi } from "./ai";
import { runConfirm, runDelivery } from "./delivery";
import { runRaise, runRestore } from "./items";
import { log, pruneLogs } from "./log";
import { getSettings, patchSettings, type Settings } from "./settings";

interface EngineState {
  timer: NodeJS.Timeout | null;
  active: boolean;
  busy: boolean;
  startedAt: number | null;
  lastTickAt: number | null;
  lastTickMs: number | null;
  lastError: string | null;
  ticks: number;
  lastPrune: number;
}

const g = globalThis as typeof globalThis & { __playerokEngine?: EngineState };
const state: EngineState = (g.__playerokEngine ??= {
  timer: null,
  active: false,
  busy: false,
  startedAt: null,
  lastTickAt: null,
  lastTickMs: null,
  lastError: null,
  ticks: 0,
  lastPrune: 0,
});

export function engineStatus() {
  return {
    active: state.active,
    busy: state.busy,
    startedAt: state.startedAt,
    lastTickAt: state.lastTickAt,
    lastTickMs: state.lastTickMs,
    lastError: state.lastError,
    ticks: state.ticks,
  };
}

export function createClient(s: Settings) {
  if (!s.playerokToken) throw new Error("Не указан токен Playerok");
  return new PlayerokClient({
    token: s.playerokToken,
    cookies: s.playerokCookies,
    userAgent: s.userAgent,
  });
}

function due(last: Date | null, everyMin: number) {
  return !last || Date.now() - +last >= everyMin * 60_000;
}

async function safe(module: string, fn: () => Promise<unknown>) {
  try {
    await fn();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    state.lastError = `${module}: ${msg}`;
    await log("error", module, msg, { dedupeMs: 120_000 });
    if (e instanceof PlayerokError && (e.kind === "auth" || e.kind === "botcheck")) {
      throw e; // дальше смысла идти нет
    }
  }
}

/** Один цикл работы бота. */
export async function tick(opts: { force?: boolean } = {}) {
  if (state.busy) return { skipped: true };
  state.busy = true;
  const started = Date.now();
  try {
    let s = await getSettings();
    const client = createClient(s);
    await client.init();
    if (client.username !== s.accountUsername) {
      s = await patchSettings({ accountId: client.userId, accountUsername: client.username });
    }

    if (s.autoDelivery) await safe("delivery", () => runDelivery(client, s));
    if (s.autoConfirm) await safe("confirm", () => runConfirm(client, s));
    if (s.aiEnabled) await safe("ai", () => runAi(client, s));

    if (s.autoRestore && (opts.force || due(s.lastRestoreAt, s.restoreIntervalMin))) {
      await safe("restore", () => runRestore(client, s));
      await patchSettings({ lastRestoreAt: new Date() });
    }
    if (s.autoRaise && (opts.force || due(s.lastRaiseAt, s.raiseIntervalMin))) {
      await safe("raise", () => runRaise(client, s));
      await patchSettings({ lastRaiseAt: new Date() });
    }

    if (Date.now() - state.lastPrune > 3_600_000) {
      state.lastPrune = Date.now();
      await pruneLogs();
    }
    state.lastError = null;
    return { skipped: false };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    state.lastError = msg;
    await log("error", "bot", msg, { dedupeMs: 120_000 });
    return { skipped: false, error: msg };
  } finally {
    state.busy = false;
    state.lastTickAt = Date.now();
    state.lastTickMs = Date.now() - started;
    state.ticks++;
  }
}

async function loop() {
  if (!state.active) return;
  await tick();
  if (!state.active) return;
  let delay = 15_000;
  try {
    delay = Math.max(5, (await getSettings()).pollIntervalSec) * 1000;
  } catch {
    /* default */
  }
  state.timer = setTimeout(loop, delay);
}

export async function startEngine(persist = true) {
  if (state.active) return;
  state.active = true;
  state.startedAt = Date.now();
  if (persist) await patchSettings({ botEnabled: true });
  await log("info", "bot", "Бот запущен");
  void loop();
}

export async function stopEngine(persist = true) {
  state.active = false;
  state.startedAt = null;
  if (state.timer) clearTimeout(state.timer);
  state.timer = null;
  if (persist) await patchSettings({ botEnabled: false });
  await log("info", "bot", "Бот остановлен");
}

/** Вызывается при старте сервера: поднимает бота, если он был включён. */
export async function bootEngine() {
  try {
    const s = await getSettings();
    if (s.botEnabled && !state.active) {
      state.active = true;
      state.startedAt = Date.now();
      await log("info", "bot", "Бот автоматически запущен после перезапуска сервера");
      void loop();
    }
  } catch (e) {
    console.error("[bot] boot failed", e);
  }
}
