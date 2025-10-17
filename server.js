import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import Stripe from "stripe";
import sqlite3 from "sqlite3";
import { open } from "sqlite";
import bodyParser from "body-parser";

dotenv.config();

const app = express();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

app.use(cors({ origin: "*", methods: ["GET", "POST", "OPTIONS"], allowedHeaders: ["Content-Type"] }));
app.use(express.json());
app.use(bodyParser.json());
app.use(express.static("public"));

// ✅ Root route for Render check
app.get("/", (req, res) => res.send("<h2>The Bambir Vinyl Bot is running 🎸</h2>"));

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

// ✅ Stripe Checkout API route
app.post("/create-checkout", async (req, res) => {
  console.log("📦 Incoming checkout data:", req.body);
  try {
    const { name, address, phone, quantity } = req.body;
    if (!name || !address || !phone || !quantity) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    await db.run(
      "INSERT INTO orders (name, address, phone, quantity) VALUES (?, ?, ?, ?)",
      [name, address, phone, quantity]
    );

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: { name: "The Bambir Vinyl – Mankakan Khagher" },
            unit_amount: 2000,
          },
          quantity,
        },
      ],
      success_url: `${process.env.RENDER_URL}/success.html`,
      cancel_url: `${process.env.RENDER_URL}/cancel.html`,
    });

    return res.json({ url: session.url });
  } catch (err) {
    console.error("❌ Checkout error:", err);
    res.status(500).json({ error: "Failed to create checkout session" });
  }
});

// ✅ Fallback route (always last)
app.use((req, res) => {
  res.status(404).send("⚠️ Route not found. The Bambir Vinyl server is alive but this path doesn’t exist.");
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🌐 Server running on port ${PORT}`));
