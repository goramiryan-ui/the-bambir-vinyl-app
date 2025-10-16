import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import sqlite3 from "sqlite3";
import { open } from "sqlite";
import { Telegraf } from "telegraf";
import Stripe from "stripe";

// ✅ Environment variables (Render reads them automatically)
const BOT_TOKEN = process.env.BOT_TOKEN;
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const DATABASE_URL = process.env.DATABASE_URL || "./database.sqlite";
const PORT = process.env.PORT || 10000;

// ✅ Check for required variables
if (!BOT_TOKEN) {
  console.error("❌ BOT_TOKEN is missing!");
  process.exit(1);
}

if (!STRIPE_SECRET_KEY) {
  console.error("❌ STRIPE_SECRET_KEY is missing!");
  process.exit(1);
}

// ✅ Initialize dependencies
const stripe = new Stripe(STRIPE_SECRET_KEY);
const bot = new Telegraf(BOT_TOKEN);
const app = express();

app.use(cors());
app.use(bodyParser.json());
app.use(express.static("public"));

// ✅ Initialize SQLite database
const dbPromise = open({
  filename: DATABASE_URL,
  driver: sqlite3.Database,
});

(async () => {
  const db = await dbPromise;
  await db.exec(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      address TEXT,
      phone TEXT,
      quantity INTEGER,
      amount INTEGER
    )
  `);
  console.log("✅ Database initialized");
})();

// ✅ Stripe checkout route
app.post("/create-checkout", async (req, res) => {
  try {
    const { name, address, phone, quantity } = req.body;
    const prices = { 1: 20, 2: 40, 3: 60 };
    const amount = prices[quantity] * 100;

    const db = await dbPromise;
    await db.run(
      "INSERT INTO orders (name, address, phone, quantity, amount) VALUES (?, ?, ?, ?, ?)",
      [name, address, phone, quantity, amount / 100]
    );

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: { name: `Vinyl x${quantity}` },
            unit_amount: amount / quantity,
          },
          quantity,
        },
      ],
      mode: "payment",
      success_url: "https://the-bambir-vinyl-app.onrender.com/success",
      cancel_url: "https://the-bambir-vinyl-app.onrender.com/cancel",
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error("❌ Stripe checkout error:", error);
    res.status(500).json({ error: "Checkout failed" });
  }
});

// ✅ Telegram Bot start message
bot.start((ctx) => {
  ctx.reply("Welcome to GA Test Vinyl Store! 🎸 Click below to order your vinyl:", {
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: "💿 Buy Vinyl",
            web_app: { url: "https://the-bambir-vinyl-app.onrender.com/miniapp.html" },
          },
        ],
      ],
    },
  });
});

// ✅ Launch bot
bot.launch().then(() => {
  console.log("🤖 Telegram bot is running!");
});

// ✅ Start Express server
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
