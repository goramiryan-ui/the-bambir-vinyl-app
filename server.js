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

app.use(
  cors({
    origin: "*", // allow Telegram and all origins
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
  })
);
app.use(express.json());
app.use(express.static("public"));
app.use(bodyParser.json());

// ✅ Root route for Render health check
app.get("/", (req, res) => {
  res.send("<h2>The Bambir Vinyl Bot is running 🎸</h2>");
});

// ✅ Initialize SQLite database
export const db = await open({
  filename: "./orders.db",
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
  const { name, address, phone, quantity } = req.body;
  const amount = 2000 * Number(quantity); // $20 each vinyl

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
          unit_amount: 2000,
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
});

// ✅ Start server
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🌐 Server running on port ${PORT}`);
});
