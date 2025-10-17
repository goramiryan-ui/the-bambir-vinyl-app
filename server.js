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

// ✅ Configure CORS to allow Telegram Mini App requests
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
  })
);

// ✅ Handle preflight (OPTIONS) requests
app.options("/create-checkout", (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.sendStatus(204);
});

app.use(express.json());
app.use(express.static("public"));
app.use(bodyParser.json());

// ✅ Root route for Render health check
app.get("/", (req, res) => {
  res.send("<h2>The Bambir Vinyl Bot is running 🎸</h2>");
});

// ✅ Initialize SQLite database
export const db = await open({
  filename: "./sales.db", // use your actual file name here
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

// ✅ Create Stripe Checkout Session
app.post("/create-checkout", async (req, res) => {
  console.log("📦 Incoming checkout data:", req.body);

  const { name, address, phone, quantity } = req.body;

  if (!name || !address || !phone || !quantity) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  await db.run(
    "INSERT INTO orders (name, address, phone, quantity) VALUES (?, ?, ?, ?)",
    [name, address, phone, quantity]
  );

  try {
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
  } catch (error) {
    console.error("❌ Stripe error:", error);
    res.status(500).json({ error: "Stripe session creation failed" });
  }
});

// ✅ Start server
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🌐 Server running on port ${PORT}`);
});
