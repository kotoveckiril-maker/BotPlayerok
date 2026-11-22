export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { bootEngine } = await import("@/lib/bot/engine");
    // небольшая задержка, чтобы БД успела подняться/применить схему
    setTimeout(() => {
      void bootEngine();
    }, 5000);
  }
}
