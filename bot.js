const { Telegraf, Markup } = require('telegraf');
const { createCheckoutSession } = require('./server');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');

// Load environment variables
const BOT_TOKEN = process.env.BOT_TOKEN;
if (!BOT_TOKEN) {
  console.error('❌ BOT_TOKEN missing');
  process.exit(1);
}

// Initialize Telegraf bot
const bot = new Telegraf(BOT_TOKEN);

// ================== DATABASE ==================
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

// ================== START MESSAGE ==================
bot.start((ctx) => {
  ctx.replyWithPhoto(
    { url: 'https://the-bambir-vinyl-app.onrender.com/public/vinyl-cover.jpg' }, // Replace with your own image if needed
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

// ================== ORDER FLOW ==================
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

  // Step 1: name
  if (step === 'pending' || step === 'name') {
    await db.run('UPDATE orders SET name = ?, status = ? WHERE id = ?', [
      ctx.message.text,
      'quantity',
      order.id,
    ]);
    return ctx.replyWithMarkdown(
      '*Select quantity:*',
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

  // Step 2b: custom quantity
  if (step === 'custom_quantity') {
    await db.run('UPDATE orders SET quantity = ?, status = ? WHERE id = ?', [
      ctx.message.text,
      'phone',
      order.id,
    ]);
    return ctx.replyWithMarkdown('*Please enter your mobile number:*');
  }

  // Step 3: phone (with validation)
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

  // Step 4: address -> generate checkout link
  if (step === 'address') {
    await db.run('UPDATE orders SET address = ?, status = ? WHERE id = ?', [
      ctx.message.text,
      'review',
      order.id,
    ]);

    const updatedOrder = await db.get('SELECT * FROM orders WHERE id = ?', order.id);
    const q = parseInt(updatedOrder.quantity);
    const prices = { 1: 20, 2: 40, 3: 60, 4: 80, 5: 100 };
    const amount = prices[q] ? prices[q] : q * 20;

    const checkoutUrl = await createCheckoutSession(updatedOrder, amount);

    await db.run('UPDATE orders SET status = ? WHERE id = ?', ['payment_link', order.id]);

    return ctx.replyWithMarkdown(
      `*Order Summary:*\n\n👤 Name: ${updatedOrder.name}\n📦 Quantity: ${updatedOrder.quantity}\n📱 Phone: ${updatedOrder.phone}\n🏠 Address: ${updatedOrder.address}\n\n💰 *Total: $${amount}*`,
      Markup.inlineKeyboard([[Markup.button.url('💳 Pay Now', checkoutUrl)]])
    );
  }
});

// ================== QUANTITY SELECTIONS ==================
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

// ================== BOT LAUNCH ==================
bot
  .launch({
    dropPendingUpdates: true,
    polling: { timeout: 60 },
  })
  .then(() => console.log('🤖 Telegram bot running successfully!'))
  .catch((err) => console.error('❌ Bot launch failed:', err));

// Graceful stop (Render restarts automatically)
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
