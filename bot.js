const { Telegraf, Markup } = require('telegraf');
const { createCheckoutSession } = require('./server');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');

const BOT_TOKEN = process.env.BOT_TOKEN;
const bot = new Telegraf(BOT_TOKEN);

// Database
const dbPromise = open({
  filename: './database.sqlite',
  driver: sqlite3.Database,
});

(async () => {
  const db = await dbPromise;
  await db.exec(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT,
      name TEXT,
      phone TEXT,
      address TEXT,
      quantity INTEGER,
      status TEXT DEFAULT 'pending'
    )
  `);
  console.log('✅ Database ready for orders');
})();

// Start message
bot.start((ctx) => {
  ctx.replyWithPhoto(
    { url: 'https://the-bambir-vinyl-app.onrender.com/public/vinyl-cover.jpg' },
    {
      caption:
        '*Welcome to The Bambir Telegram Shop!*\n\nMankakan Khagher Vinyl is now on sale!\n\nClick below to order your vinyl:',
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [[{ text: '💿 Buy Now', callback_data: 'start_order' }]],
      },
    }
  );
});

// Order flow
bot.action('start_order', async (ctx) => {
  ctx.replyWithMarkdown('*Please enter your full name:*');
  const db = await dbPromise;
  await db.run('INSERT INTO orders (user_id) VALUES (?)', [ctx.from.id]);
});

bot.on('text', async (ctx) => {
  const db = await dbPromise;
  const order = await db.get(
    'SELECT * FROM orders WHERE user_id = ? ORDER BY id DESC LIMIT 1',
    [ctx.from.id]
  );
  if (!order) return;

  const step = order.status || 'name';

  if (step === 'pending' || step === 'name') {
    await db.run('UPDATE orders SET name = ?, status = ? WHERE id = ?', [
      ctx.message.text,
      'quantity',
      order.id,
    ]);
    return ctx.reply(
      'Select quantity:',
      Markup.inlineKeyboard([
        [
          Markup.button.callback('1', 'qty_1'),
          Markup.button.callback('2', 'qty_2'),
          Markup.button.callback('3', 'qty_3'),
        ],
        [
          Markup.button.callback('4', 'qty_4'),
          Markup.button.callback('5', 'qty_5'),
          Markup.button.callback('6+', 'qty_custom'),
        ],
      ])
    );
  }

  if (step === 'custom_quantity') {
    await db.run('UPDATE orders SET quantity = ?, status = ? WHERE id = ?', [
      ctx.message.text,
      'phone',
      order.id,
    ]);
    return ctx.replyWithMarkdown('*Please enter your mobile number:*');
  }

  if (step === 'phone') {
    const phone = ctx.message.text.trim();
    if (!/^\d{9,}$/.test(phone)) {
      return ctx.reply('❌ Please enter a valid phone number (digits only, min 9 digits).');
    }
    await db.run('UPDATE orders SET phone = ?, status = ? WHERE id = ?', [
      phone,
      'address',
      order.id,
    ]);
    return ctx.replyWithMarkdown('*Please enter your delivery address:*');
  }

  if (step === 'address') {
    await db.run('UPDATE orders SET address = ?, status = ? WHERE id = ?', [
      ctx.message.text,
      'review',
      order.id,
    ]);
    const updated = await db.get('SELECT * FROM orders WHERE id = ?', order.id);

    const q = parseInt(updated.quantity);
    const prices = { 1: 20, 2: 40, 3: 60, 4: 80, 5: 100 };
    const amount = prices[q] ? prices[q] : q * 20;

    const checkoutUrl = await createCheckoutSession(updated, amount);
    await db.run('UPDATE orders SET status = ? WHERE id = ?', ['payment_link', order.id]);

    return ctx.replyWithMarkdown(
      `*Order Summary:*\n\n👤 Name: ${updated.name}\n📦 Quantity: ${updated.quantity}\n📱 Phone: ${updated.phone}\n🏠 Address: ${updated.address}\n\n💰 *Total: $${amount}*`,
      Markup.inlineKeyboard([[Markup.button.url('💳 Pay Now', checkoutUrl)]])
    );
  }
});

bot.action(/qty_(.+)/, async (ctx) => {
  const quantity = ctx.match[1];
  const db = await dbPromise;
  const order = await db.get(
    'SELECT * FROM orders WHERE user_id = ? ORDER BY id DESC LIMIT 1',
    [ctx.from.id]
  );

  if (quantity === 'custom') {
    await db.run('UPDATE orders SET status = ? WHERE id = ?', ['custom_quantity', order.id]);
    return ctx.replyWithMarkdown('*Please enter your desired quantity:*');
  }

  await db.run('UPDATE orders SET quantity = ?, status = ? WHERE id = ?', [
    quantity,
    'phone',
    order.id,
  ]);
  return ctx.replyWithMarkdown('*Please enter your mobile number:*');
});

bot.launch().then(() => console.log('🤖 Telegram bot running successfully!'));
