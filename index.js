import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import sqlite3 from "sqlite3";
import { open } from "sqlite";
import { Telegraf, Markup } from "telegraf";
import Stripe from "stripe";

// =================== CONFIG ===================
const BOT_TOKEN = process.env.BOT_TOKEN;
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const DATABASE_URL = process.env.DATABASE_URL || "./database.sqlite";
const PORT = process.env.PORT || 10000;
const STRIPE_DOMAIN = "https://the-bambir-vinyl-app.onrender.com";

if (!BOT_TOKEN || !STRIPE_SECRET_KEY) {
  console.error("❌ Missing environment variables.");
  process.exit(1);
}

// =================== INIT ===================
const bot = new Telegraf(BOT_TOKEN);
const stripe = new Stripe(STRIPE_SECRET_KEY);
const app = express();

app.use(cors());
app.use(bodyParser.json());
app.use(express.static("public"));

// =================== DATABASE ===================
const dbPromise = open({
  filename: DATABASE_URL,
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
      quantity TEXT,
      status TEXT DEFAULT 'pending'
    )
  `);
  console.log("✅ Database initialized");
})();

// =================== BOT FLOW ===================

// Welcome message
bot.start((ctx) => {
  ctx.replyWithMarkdown(
    "*Welcome to The Bambir Telegram Shop!*\n\nMankakan Khagher Vinyl is now on sale!\n\nClick below to order your vinyl:",
    Markup.inlineKeyboard([[Markup.button.callback("💿 Buy Now", "start_order")]])
  );
});

// Start order flow
bot.action("start_order", async (ctx) => {
  ctx.reply("Please enter your full name:");
  const db = await dbPromise;
  await db.run("INSERT INTO orders (user_id) VALUES (?)", [ctx.from.id]);
});

// Handle text inputs
bot.on("text", async (ctx) => {
  const db = await dbPromise;
  const order = await db.get(
    "SELECT * FROM orders WHERE user_id = ? ORDER BY id DESC LIMIT 1",
    [ctx.from.id]
  );
  if (!order) return;

  const step = order.status || "name";

  // Step 1: Name
  if (step === "pending" || step === "name") {
    await db.run("UPDATE orders SET name = ?, status = ? WHERE id = ?", [
      ctx.message.text,
      "quantity",
      order.id,
    ]);
    return ctx.reply(
      "Select the quantity you'd like to order:",
      Markup.inlineKeyboard([
        [
          Markup.button.callback("1", "qty_1"),
          Markup.button.callback("2", "qty_2"),
          Markup.button.callback("3", "qty_3"),
        ],
        [
          Markup.button.callback("4", "qty_4"),
          Markup.button.callback("5", "qty_5"),
          Markup.button.callback("6+", "qty_custom"),
        ],
      ])
    );
  }

  // Step 2b: Custom quantity
  if (step === "custom_quantity") {
    await db.run("UPDATE orders SET quantity = ?, status = ? WHERE id = ?", [
      ctx.message.text,
      "phone",
      order.id,
    ]);
    return ctx.reply("Please enter your mobile number:");
  }

  // Step 3: Phone number (validation)
  if (step === "phone") {
    const phone = ctx.message.text.trim();

    if (!/^\d{9,}$/.test(phone)) {
      return ctx.reply("❌ Please enter a valid phone number (digits only, min 9 digits).");
    }

    await db.run("UPDATE orders SET phone = ?, status = ? WHERE id = ?", [
      phone,
      "address",
      order.id,
    ]);
    return ctx.reply("Please enter your delivery address:");
  }

  // Step 4: Address → Generate Stripe link
  if (step === "address") {
    await db.run("UPDATE orders SET address = ?, status = ? WHERE id = ?", [
      ctx.message.text,
      "review",
      order.id,
    ]);

    const updatedOrder = await db.get("SELECT * FROM orders WHERE id = ?", order.id);

    const q = parseInt(updatedOrder.quantity);
    const prices = { 1: 20, 2: 40, 3: 60, 4: 80, 5: 100 };
    const amount = prices[q] ? prices[q] : q * 20;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: { name: `Mankakan Khagher Vinyl x${updatedOrder.quantity}` },
            unit_amount: (amount * 100) / updatedOrder.quantity,
          },
          quantity: updatedOrder.quantity,
        },
      ],
      mode: "payment",
      success_url: `${STRIPE_DOMAIN}/success`,
      cancel_url: `${STRIPE_DOMAIN}/cancel`,
    });

    await db.run("UPDATE orders SET status = ? WHERE id = ?", ["payment_link", order.id]);

    return ctx.replyWithMarkdown(
      `*Order Summary:*\n\n👤 Name: ${updatedOrder.name}\n📦 Quantity: ${updatedOrder.quantity}\n📱 Phone: ${updatedOrder.phone}\n🏠 Address: ${updatedOrder.address}\n\n💰 *Total: $${amount}*`,
      Markup.inlineKeyboard([
        [Markup.button.webApp("💳 Pay Now", session.url)],
      ])
    );
  }
});

// Quantity selections
bot.action(/qty_(.+)/, async (ctx) => {
  const quantity = ctx.match[1];
  const db = await dbPromise;
  const order = await db.get(
    "SELECT * FROM orders WHERE user_id = ? ORDER BY id DESC LIMIT 1",
    [ctx.from.id]
  );

  if (quantity === "custom") {
    await db.run("UPDATE orders SET status = ? WHERE id = ?", [
      "custom_quantity",
      order.id,
    ]);
    return ctx.reply("Please enter your desired quantity:");
  }

  await db.run("UPDATE orders SET quantity = ?, status = ? WHERE id = ?", [
    quantity,
    "phone",
    order.id,
  ]);
  return ctx.reply("Please enter your mobile number:");
});

// =================== EXPRESS ===================
app.get("/", (req, res) => {
  res.send("✅ The Bambir Vinyl Bot backend is running.");
});

// =================== LAUNCH ===================
bot.launch().then(() => console.log("🤖 Bot running!"));
app.listen(PORT, () => console.log(`✅ Server running on ${PORT}`));
