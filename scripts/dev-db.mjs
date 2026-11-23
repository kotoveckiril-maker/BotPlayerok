/**
 * Локальная PostgreSQL-совместимая БД для разработки и тестов (PGlite).
 * Запуск: node scripts/dev-db.mjs
 * Затем: DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/postgres npm run dev
 */
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";

const db = await PGlite.create();
const server = new PGLiteSocketServer({
  db,
  port: Number(process.env.PG_PORT || 5432),
  host: "127.0.0.1",
  maxConnections: 10,
});

await server.start();
console.log(`[dev-db] PGlite listening on 127.0.0.1:${process.env.PG_PORT || 5432}`);

async function shutdown() {
  await server.stop();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
