import { Client } from 'pg';

if (process.env.CONFIRM_DEMO !== '1') {
  console.error('Этот скрипт УДАЛЯЕТ товары, склад, сделки и выдачи в указанной БД и заполняет демо-данными.');
  console.error('Для подтверждения запустите: CONFIRM_DEMO=1 node scripts/seed-demo.mjs');
  process.exit(1);
}

const c = new Client({ connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:5432/postgres' });
await c.connect();
await c.query('begin');
await c.query('delete from deliveries');
await c.query('delete from stock_items');
await c.query('delete from products');
await c.query('delete from deals');
await c.query('delete from ai_usage');
await c.query('delete from logs');
await c.query('delete from chat_state');

const products = [
  { title: 'Steam ключ | Random', mode: 'unit', playerokItemId: 'item-steam', keyword: 'steam', message: 'Спасибо за покупку! ✅\n\nВаш ключ:\n{data}\n\nАктивируйте в Steam и подтвердите получение.', description: 'Ключ активируется в любом регионе. Выдаётся автоматически сразу после оплаты.', price: 149 },
  { title: 'Discord Nitro | 12 месяцев', mode: 'unit', playerokItemId: 'item-nitro', keyword: 'nitro', message: 'Ваш подарок Discord Nitro:\n{data}\n\nСпасибо за покупку! ❤️', description: 'Подарочная ссылка на 12 месяцев. Активация без привязки карты.', price: 499 },
  { title: 'Гайд: фарм голды в MMO', mode: 'message', playerokItemId: 'item-guide', keyword: 'гайд', message: 'Спасибо! Гайд уже в чате — проверьте закреплённое сообщение. Если нужны обновления — напишите.', description: 'Подробный PDF-гайд, обновляется бесплатно.', price: 299 },
];
const pids = {};
for (const p of products) {
  const r = await c.query('insert into products (title, mode, playerok_item_id, keyword, message, description, enabled) values ($1,$2,$3,$4,$5,$6,true) returning id', [p.title, p.mode, p.playerokItemId, p.keyword, p.message, p.description]);
  pids[p.playerokItemId] = r.rows[0].id;
}
const stocks = [
  ['item-steam', ['STEAM-XXXX-1111', 'STEAM-XXXX-2222', 'STEAM-XXXX-3333', 'STEAM-XXXX-4444', 'STEAM-XXXX-5555', 'STEAM-XXXX-6666']],
  ['item-nitro', ['https://discord.gift/NITRO-AAAA', 'https://discord.gift/NITRO-BBBB', 'https://discord.gift/NITRO-CCCC']],
];
for (const [item, keys] of stocks) for (const k of keys) await c.query('insert into stock_items (product_id, content, status) values ($1,$2,\'available\')', [pids[item], k]);

const buyers = ['Alexey', 'Marina', 'Dmitry', 'Ksenia', 'Vlad', 'Olga', 'Sergey', 'Nastya'];
const statuses = ['CONFIRMED', 'SENT', 'CONFIRMED_AUTOMATICALLY', 'PAID', 'PENDING', 'ROLLED_BACK'];
const items = [
  { id: 'item-steam', name: 'Steam ключ | Random', price: 149 },
  { id: 'item-nitro', name: 'Discord Nitro | 12 месяцев', price: 499 },
  { id: 'item-guide', name: 'Гайд: фарм голды в MMO', price: 299 },
];
let stockIndex = { 'item-steam': 1, 'item-nitro': 0 };
let dealNo = 0;
for (let d = 13; d >= 0; d--) {
  const count = 1 + Math.floor(Math.random() * 2);
  for (let i = 0; i < count; i++) {
    const it = items[Math.floor(Math.random() * items.length)];
    const st = statuses[Math.floor(Math.random() * statuses.length)];
    const buyer = buyers[Math.floor(Math.random() * buyers.length)];
    const created = new Date(Date.now() - d * 86400000 - Math.floor(Math.random() * 10) * 3600000);
    const sold = ['CONFIRMED', 'SENT', 'CONFIRMED_AUTOMATICALLY', 'PAID'].includes(st);
    dealNo++;
    const id = `demo-deal-${dealNo}`;
    await c.query(`insert into deals (id, status, direction, buyer_id, buyer_username, item_id, item_name, price, currency, chat_id, created_at, completed_at, updated_at)
      values ($1,$2,'OUT',$3,$4,$5,$6,$7,'RUB',$8,$9,$10,now())`,
      [id, st, `b-${buyer}`, buyer, it.id, it.name, it.price, `chat-${dealNo}`, created, sold ? new Date(+created + 3600000) : null]);
    if (sold) {
      const stock = stocks.find(([item]) => item === it.id);
      if (it.mode !== 'message' && stock) {
        const idx = stockIndex[it.id] ?? 0;
        const content = stock[1][idx] ?? null;
        stockIndex[it.id] = idx + 1;
        if (content) await c.query('update stock_items set status=\'sold\', deal_id=$1, sold_at=$2 where content=$3 and status=\'available\'', [id, new Date(+created + 1800000), content]);
      }
      const deliveredAt = new Date(+created + 90 * 1000);
      await c.query(`insert into deliveries (deal_id, product_id, item_name, buyer, buyer_id, chat_id, status, delivered, attempts, confirmed, confirmed_at, price, currency, created_at, updated_at)
        values ($1,$2,$3,$4,$5,$6,'delivered',$7,1,true,$8,$9,'RUB',$10,$11)`,
        [id, pids[it.id], it.name, buyer, `b-${buyer}`, `chat-${dealNo}`, it.mode === 'message' ? '(сообщение)' : 'KEY', deliveredAt, it.price, created, deliveredAt]);
    } else if (st === 'PENDING' && dealNo === 5) {
      await c.query(`insert into deliveries (deal_id, product_id, item_name, buyer, buyer_id, chat_id, status, attempts, confirmed, price, currency, created_at, updated_at)
        values ($1,$2,$3,$4,$5,$6,'no_stock',1,false,$7,'RUB',$8,$9)`,
        [id, pids[it.id], it.name, buyer, `b-${buyer}`, `chat-${dealNo}`, it.price, created, created]);
    }
  }
}

for (let d = 6; d >= 0; d--) {
  const day = new Date(Date.now() - d * 86400000).toISOString().slice(0, 10);
  const requests = 8 + Math.floor(Math.random() * 18);
  const replies = Math.max(0, requests - 2 - Math.floor(Math.random() * 4));
  await c.query(`insert into ai_usage (day, model, requests, replies, handoffs, errors, tokens_in, tokens_out)
    values ($1,'gpt-4o-mini',$2,$3,$4,$5,$6,$7) on conflict (day) do update set requests=excluded.requests, replies=excluded.replies, handoffs=excluded.handoffs, tokens_in=excluded.tokens_in, tokens_out=excluded.tokens_out`,
    [day, requests, replies, requests - replies, 0, requests * 420, replies * 90]);
}

await c.query(`insert into logs (level, module, message, created_at) values
  ('success','delivery','Сделка demo-deal-1: выдан «Steam ключ | Random» покупателю Alexey', now() - interval '2 hours'),
  ('success','ai','Чат chat-1: «Привет, есть в наличии?» → «Здравствуйте! Да, товар в наличии, выдача автоматическая после оплаты.»', now() - interval '3 hours'),
  ('warn','ai','Чат chat-2: ИИ передал диалог продавцу — «Можно скидку?»', now() - interval '5 hours'),
  ('error','delivery','Сделка demo-deal-5: на складе «Discord Nitro | 12 месяцев» нет товара! Пополните склад', now() - interval '8 hours'),
  ('info','bot','Бот автоматически запущен после перезапуска сервера', now() - interval '9 hours')`);
await c.query('commit');
console.log('demo data seeded');
await c.end();
