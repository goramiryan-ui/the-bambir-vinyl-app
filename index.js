import express from "express";
import { Telegraf, Markup } from "telegraf";
import Stripe from "stripe";
import "dotenv/config";
import { dbPromise } from "./database.js";

const app = express();
app.use(express.static("public"));
app.use(express.json());

// init Telegram bot & Stripe
const bot = new Telegraf(process.env.BOT_TOKEN);
const stripe = new Stripe(process.env.STRIPE_SECRET);

// ✅ Telegram Bot Start Command
bot.start((ctx) => {
  ctx.reply(
    "🎸 Welcome to GA Test E-commerce Vinyl Store!\n\nOwn our limited-edition record.",
    Markup.inlineKeyboard([
      [Markup.button.webApp("💿 Buy Now", "https://the-bambir-vinyl-app.onrender.com")]
    ])
  );
});

// ✅ Stripe Checkout
app.post("/create-checkout", async (req, res) => {
  const { name, address, phone, quantity } = req.body;
  const amount = quantity * 2000; // price in cents ($20 each)

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: { name: `GA Test E-commerce Vinyl (${quantity} pcs)` },
            unit_amount: 2000,
          },
          quantity,
        },
      ],
      success_url: "https://t.me/GA_Test_Eccomerce_bot",
      cancel_url: "https://t.me/GA_Test_Eccomerce_bot",
    });

    const db = await dbPromise;
    await db.run(
      `INSERT INTO sales (name, address, phone, quantity, amount, stripe_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [name, address, phone, quantity, amount / 100, session.id]
    );

    res.json({ url: session.url });
  } catch (err) {
    console.error("Stripe error:", err);
    res.status(500).json({ error: "Failed to create checkout session" });
  }
});

// ✅ Start bot & server
bot.launch();
app.listen(process.env.PORT, () => console.log(`Server running on ${process.env.PORT}`));
