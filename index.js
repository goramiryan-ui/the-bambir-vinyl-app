import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import { dbPromise } from "./database.js";
import Stripe from "stripe";
import { Telegraf } from "telegraf";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 10000;

// ✅ Initialize Stripe with your secret key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// ✅ Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static("public")); // serve miniapp.html and assets

// ✅ Root route (fixes “Cannot GET /”)
app.get("/", (req, res) => {
  res.send("🎸 GA Test E-commerce Vinyl Bot is running fine! Visit /miniapp.html");
});

// ✅ Initialize Telegram Bot
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// /start command
bot.start(async (ctx) => {
  await ctx.reply(
    "🎸 Welcome to GA Test E-commerce Vinyl Store!\nClick below to buy your vinyl:",
    {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "🛒 Buy Now",
              web_app: {
                url: "https://the-bambir-vinyl-app.onrender.com/miniapp.html", // 👈 your live Mini App
              },
            },
          ],
        ],
      },
    }
  );
});

// ✅ Stripe checkout endpoint
app.post("/create-checkout", async (req, res) => {
  try {
    const { name, address, phone, quantity } = req.body;
    const prices = { 1: 2000, 2: 4000, 3: 6000 }; // in cents

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: { name: "GA Test E-commerce Vinyl" },
            unit_amount: prices[quantity] || 2000,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: "https://t.me/GA_Test_Eccomerce_bot",
      cancel_url: "https://t.me/GA_Test_Eccomerce_bot",
    });

    const db = await dbPromise;
    await db.run(
      `INSERT INTO sales (name, address, phone, quantity, amount, stripe_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [name, address, phone, quantity, prices[quantity] / 100, session.id]
    );

    res.json({ url: session.url });
  } catch (error) {
    console.error("Checkout error:", error);
    res.status(500).json({ error: "Failed to create checkout session" });
  }
});

// ✅ Start bot & web server
bot.launch();
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
