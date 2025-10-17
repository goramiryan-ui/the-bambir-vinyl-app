import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import Stripe from "stripe";
import sqlite3 from "sqlite3";
import { open } from "sqlite";

dotenv.config();

const app = express();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

// ✅ Root route for Render check
app.get("/", (req, res) => {
  res.send("<h2>The Bambir Vinyl Bot is running 🎸</h2>");
});

// ✅ SQLite Database
const db = await open({
  filename: "./sales.db",
  driver: sqlite3.Database,
});
await db.exec(`
  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    address TEXT,
    phone TEXT,
    quantity INTEGER,
    payment_status TEXT DEFAULT 'pending'
  )
`);
console.log("✅ Database initialized");

// ✅ Stripe Checkout Session
app.post("/create-checkout", async (req, res) => {
  try {
    console.log("📦 Incoming checkout data:", req.body);
    const { name, address, phone, quantity } = req.body;

    if (!name || !address || !phone || !quantity) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    await db.run(
      "INSERT INTO orders (name, address, phone, quantity) VALUES (?, ?, ?, ?)",
      [name, address, phone, quantity]
    );

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: { name: "The Bambir Vinyl – Mankakan Khagher" },
            unit_amount: 2000, // $20 per vinyl
          },
          quantity: quantity,
        },
      ],
      mode: "payment",
      success_url: `${process.env.RENDER_URL}/success.html`,
      cancel_url: `${process.env.RENDER_URL}/cancel.html`,
      metadata: { name, address, phone, quantity },
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error("❌ Stripe error:", err.message);
    res.status(500).json({ error: "Failed to create checkout session" });
  }
});

// ✅ Start server
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🌐 Server running on port ${PORT}`);
});
