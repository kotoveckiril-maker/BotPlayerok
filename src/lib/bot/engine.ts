import os from "node:os";
import { createHash } from "node:crypto";
import { PlayerokClient, PlayerokError } from "@/lib/playerok/client";
import { runAi } from "./ai";
import { syncDeals } from "./deals";
import { runConfirm, runDelivery } from "./delivery";
import { runRaise, runRestore } from "./items";
import { log, pruneLogs } from "./log";
import { notifyError } from "./notify";
import { getSettings, patchSettings, type Settings } from "./settings";

export type ModuleName =
  | "delivery"
  | "confirm"
  | "ai"
  | "raise"
  | "restore"
  | "deals"
  | "prune";

export interface ModuleMetrics {
  runs: number;
  ok: number;
  errors: number;
  lastRunAt: number | null;
  lastOkAt: number | null;
  lastMs: number | null;
  avgMs: number | null;
  lastError: string | null;
  lastResult: string;
}

export interface TickPoint {
  at: number;
  ms: number;
  ok: boolean;
  delivered: number;
  deals: number;
  replied: number;
}

export interface AccountInfo {
  username: string;
  userId: string;
  balance: number;
  unreadChats: number;
  updatedAt: number;
}

interface EngineState {
  timer: NodeJS.Timeout | null;
  active: boolean;
  busy: boolean;
  startedAt: number | null;
  stoppedAt: number | null;
  lastTickAt: number | null;
  lastTickMs: number | null;
  avgTickMs: number | null;
  lastError: string | null;
  lastErrorKind: string | null;
  ticks: number;
  errors: number;
  consecutiveErrors: number;
  lastPrune: number;
  lastDealsSyncAt: number | null;
  modules: Record<string, ModuleMetrics>;
  tickHistory: TickPoint[];
  accountInfo: AccountInfo | null;
}

const g = globalThis as typeof globalThis & { __playerokEngine?: EngineState };
const state: EngineState = (g.__playerokEngine ??= {
  timer: null,
  active: false,
  busy: false,
  startedAt: null,
  stoppedAt: null,
  lastTickAt: null,
  lastTickMs: null,
  avgTickMs: null,
  lastError: null,
  lastErrorKind: null,
  ticks: 0,
  errors: 0,
  consecutiveErrors: 0,
  lastPrune: 0,
  lastDealsSyncAt: null,
  modules: {},
  tickHistory: [],
  accountInfo: null,
});

function moduleMetrics(name: ModuleName): ModuleMetrics {
  const m = (state.modules[name] ??= {
    runs: 0,
    ok: 0,
    errors: 0,
    lastRunAt: null,
    lastOkAt: null,
    lastMs: null,
    avgMs: null,
    lastError: null,
    lastResult: "",
  });
  return m;
}

function summarize(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "number") return String(v);
  if (typeof v === "string") return v.slice(0, 160);
  try {
    return JSON.stringify(v).slice(0, 160);
  } catch {
    return String(v).slice(0, 160);
  }
}

async function runModule<T>(
  name: ModuleName,
  fn: () => Promise<T>,
): Promise<{ result: T; ms: number }> {
  const m = moduleMetrics(name);
  const t0 = Date.now();
  m.runs++;
  m.lastRunAt = t0;
  try {
    const result = await fn();
    const ms = Date.now() - t0;
    m.ok++;
    m.lastOkAt = Date.now();
    m.lastMs = ms;
    m.avgMs = m.avgMs == null ? ms : Math.round(m.avgMs * 0.8 + ms * 0.2);
    m.lastError = null;
    m.lastResult = summarize(result);
    return { result, ms };
  } catch (e) {
    m.errors++;
    m.lastMs = Date.now() - t0;
    m.lastError = e instanceof Error ? e.message : String(e);
    throw e;
  }
}

/** Выполняет модуль, логирует ошибку и не даёт ей уронить весь цикл. */
async function safeModule<T>(name: ModuleName, fn: () => Promise<T>): Promise<T | null> {
  try {
    const r = await runModule(name, fn);
    return r.result;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    state.lastError = `${name}: ${msg}`;
    await log("error", name, msg, { dedupeMs: 120_000 });
    if (e instanceof PlayerokError && (e.kind === "auth" || e.kind === "botcheck")) {
      throw e;
    }
    return null;
  }
}

export function engineStatus() {
  const { timer: _timer, ...rest } = state;
  void _timer;
  return {
    ...rest,
    uptimeSec: state.startedAt ? Math.floor((Date.now() - state.startedAt) / 1000) : 0,
  };
}

export function moduleStatus() {
  return state.modules;
}

export function systemInfo() {
  const mem = process.memoryUsage();
  const load = os.loadavg();
  return {
    node: process.version,
    platform: `${os.platform()} ${os.arch()}`,
    pid: process.pid,
    uptimeSec: Math.floor(process.uptime()),
    rssMb: Math.round((mem.rss / 1048576) * 10) / 10,
    heapUsedMb: Math.round((mem.heapUsed / 1048576) * 10) / 10,
    heapTotalMb: Math.round((mem.heapTotal / 1048576) * 10) / 10,
    externalMb: Math.round((mem.external / 1048576) * 10) / 10,
    load1: Math.round(load[0] * 100) / 100,
    env: process.env.NODE_ENV ?? "development",
    cwd: process.cwd(),
  };
}

export function createClient(s: Settings): PlayerokClient {
  if (!s.playerokToken) throw new Error("Не указан токен Playerok");
  return new PlayerokClient({
    token: s.playerokToken,
    cookies: s.playerokCookies,
    userAgent: s.userAgent,
  });
}

/* Кэш клиента: не делаем лишний запрос viewer на каждом цикле. */
let clientCache: {
  key: string;
  client: PlayerokClient;
  info: { id: string; username: string; balance: number; unreadChats: number };
  at: number;
} | null = null;

async function getClient(s: Settings) {
  const key = createHash("sha1")
    .update(`${s.playerokToken}|${s.playerokCookies}|${s.userAgent}`)
    .digest("hex");
  if (clientCache && clientCache.key === key && Date.now() - clientCache.at < 5 * 60_000) {
    return { client: clientCache.client, info: clientCache.info };
  }
  const client = createClient(s);
  const info = await client.init();
  clientCache = { key, client, info, at: Date.now() };
  return { client, info };
}

function due(last: Date | null, everyMin: number) {
  return !last || Date.now() - +last >= everyMin * 60_000;
}

export interface TickResult {
  skipped: boolean;
  ok: boolean;
  delivered: number;
  confirmed: number;
  aiReplies: number;
  raised: number;
  restored: number;
  dealsSynced: number;
  durationMs: number;
  error?: string;
  kind?: string;
}

/** Один цикл работы бота. */
export async function tick(opts: { force?: boolean } = {}): Promise<TickResult> {
  if (state.busy) return { skipped: true, ok: true, delivered: 0, confirmed: 0, aiReplies: 0, raised: 0, restored: 0, dealsSynced: 0, durationMs: 0 };
  state.busy = true;
  const started = Date.now();
  const out: TickResult = {
    skipped: false,
    ok: true,
    delivered: 0,
    confirmed: 0,
    aiReplies: 0,
    raised: 0,
    restored: 0,
    dealsSynced: 0,
    durationMs: 0,
  };

  try {
    let s = await getSettings();
    lastSettings = s;
    state.lastError = null;
    state.lastErrorKind = null;
    const { client, info } = await getClient(s);
    state.accountInfo = {
      username: info.username,
      userId: info.id,
      balance: info.balance,
      unreadChats: info.unreadChats,
      updatedAt: Date.now(),
    };
    if (client.username !== s.accountUsername) {
      s = await patchSettings({
        accountId: client.userId,
        accountUsername: client.username,
      });
    }

    if (s.syncDeals && (opts.force || due(s.lastDealsSyncAt, 5))) {
      const r = await safeModule("deals", () =>
        syncDeals(client, { maxPages: opts.force ? 6 : 3 }),
      );
      if (r) {
        out.dealsSynced = r.synced;
        state.lastDealsSyncAt = Date.now();
        await patchSettings({ lastDealsSyncAt: new Date() });
      }
    }

    if (s.autoDelivery) {
      const n = await safeModule("delivery", () => runDelivery(client, s));
      if (typeof n === "number") out.delivered = n;
    }
    if (s.autoConfirm) {
      const n = await safeModule("confirm", () => runConfirm(client, s));
      if (typeof n === "number") out.confirmed = n;
    }
    if (s.aiEnabled) {
      const n = await safeModule("ai", () => runAi(client, s));
      if (typeof n === "number") out.aiReplies = n;
    }

    if (s.autoRestore && (opts.force || due(s.lastRestoreAt, s.restoreIntervalMin))) {
      const n = await safeModule("restore", () => runRestore(client, s));
      if (typeof n === "number") out.restored = n;
      await patchSettings({ lastRestoreAt: new Date() });
    }
    if (s.autoRaise && (opts.force || due(s.lastRaiseAt, s.raiseIntervalMin))) {
      const n = await safeModule("raise", () => runRaise(client, s));
      if (typeof n === "number") out.raised = n;
      await patchSettings({ lastRaiseAt: new Date() });
    }

    if (Date.now() - state.lastPrune > 3_600_000) {
      state.lastPrune = Date.now();
      await safeModule("prune", () => pruneLogs());
    }

    state.consecutiveErrors = 0;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    out.ok = false;
    out.error = msg;
    state.errors++;
    state.consecutiveErrors++;
    state.lastError = msg;
    await log("error", "bot", msg, { dedupeMs: 120_000 });

    if (e instanceof PlayerokError) {
      out.kind = e.kind;
      state.lastErrorKind = e.kind;
      if (e.kind === "auth" || e.kind === "botcheck") {
        // Дальше ходить нет смысла — останавливаем, чтобы не забанить аккаунт.
        await stopEngine(false);
        await log("error", "bot", "Бот остановлен из-за ошибки авторизации/антибот-защиты");
        await notifyError(safeSettings(), "Бот остановлен", msg);
      }
    }
  } finally {
    state.busy = false;
    state.lastTickAt = Date.now();
    const ms = Date.now() - started;
    state.lastTickMs = ms;
    state.avgTickMs = state.avgTickMs == null ? ms : Math.round(state.avgTickMs * 0.8 + ms * 0.2);
    state.ticks++;
    out.durationMs = ms;
    state.tickHistory.push({
      at: Date.now(),
      ms,
      ok: out.ok,
      delivered: out.delivered,
      deals: out.dealsSynced,
      replied: out.aiReplies,
    });
    if (state.tickHistory.length > 120) state.tickHistory.shift();
  }
  return out;
}

// Последние настройки для уведомлений об ошибках (без повторного чтения БД).
let lastSettings: Settings | null = null;
function safeSettings(): Settings | null {
  return lastSettings;
}

async function loop() {
  if (!state.active) return;
  await tick();
  if (!state.active) return;
  let delay = 15_000;
  try {
    const s = await getSettings();
    lastSettings = s;
    delay = Math.max(5, s.pollIntervalSec) * 1000;
  } catch {
    /* default */
  }
  // Плавный backoff при повторяющихся ошибках
  if (state.consecutiveErrors > 0) {
    delay = Math.min(300_000, delay * 2 ** Math.min(state.consecutiveErrors, 5));
  }
  state.timer = setTimeout(loop, delay);
}

/** Ручная синхронизация сделок (для кнопки в интерфейсе). */
export async function syncDealsNow(): Promise<{ synced: number; total: number }> {
  const s = await getSettings();
  const { client } = await getClient(s);
  const r = await syncDeals(client, { maxPages: 6 });
  await patchSettings({ lastDealsSyncAt: new Date() });
  state.lastDealsSyncAt = Date.now();
  return r;
}

export async function startEngine(persist = true) {
  if (state.active) return;
  state.active = true;
  state.startedAt = Date.now();
  state.stoppedAt = null;
  state.consecutiveErrors = 0;
  state.lastError = null;
  state.lastErrorKind = null;
  if (persist) await patchSettings({ botEnabled: true });
  await log("info", "bot", "Бот запущен");
  void loop();
}

export async function stopEngine(persist = true) {
  state.active = false;
  state.stoppedAt = Date.now();
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
    lastSettings = s;
    if (s.botEnabled && !state.active) {
      state.active = true;
      state.startedAt = Date.now();
      state.stoppedAt = null;
      await log("info", "bot", "Бот автоматически запущен после перезапуска сервера");
      void loop();
    } else if (!s.botEnabled) {
      await log("info", "bot", "Бот выключен в настройках — ожидает запуска");
    }
  } catch (e) {
    console.error("[bot] boot failed", e);
  }
}
