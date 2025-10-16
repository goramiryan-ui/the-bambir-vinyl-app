import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import helmet from "helmet";
import Stripe from "stripe";
import { initDB } from "./database.js";

dotenv.config();

const app = express();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const PORT = process.env.PORT || 10000;

// Middleware
app.use(express.json());
app.use(cors());
app.use(
  helmet({
    frameguard: false,
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "https://js.stripe.com"],
        connectSrc: ["'self'", "https://api.stripe.com"],
        imgSrc: ["'self'", "data:", "https://*"],
        frameAncestors: ["'self'", "https://t.me"], // allow Telegram miniapp
      },
    },
  })
);
app.use(express.static("public"));

const db = await initDB();

// 🧾 Create Stripe Checkout
app.post("/create-checkout", async (req, res) => {
  try {
    const { name, address, phone, quantity } = req.body;
    const qty = parseInt(quantity);
    const total = qty * 2000; // $20 per vinyl (in cents)

    // Save order
    await db.run(
      "INSERT INTO orders (name, address, phone, quantity, total) VALUES (?, ?, ?, ?, ?)",
      [name, address, phone, qty, total / 100]
    );

    // Create Stripe session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: { name: "Mankakan Khagher Vinyl" },
            unit_amount: total,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${process.env.APP_URL}/success`,
      cancel_url: `${process.env.APP_URL}/cancel`,
      metadata: { name, address, phone, quantity },
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error("Checkout error:", err);
    res.status(500).json({ error: "Failed to create checkout" });
  }
});

// ✅ Success page
app.get("/success", (req, res) => {
  res.send(`
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <style>
          body { background:#0f0f0f; color:white; font-family:Arial; text-align:center; padding:40px; }
          h1 { color:#00ff99; }
        </style>
      </head>
      <body>
        <h1>✅ Payment Successful!</h1>
        <p>Thank you for your purchase of <b>Mankakan Khagher Vinyl</b>.</p>
        <p>We’ll contact you soon with delivery details.</p>
      </body>
    </html>
  `);
});

// ❌ Cancel page
app.get("/cancel", (req, res) => {
  res.send(`
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <style>
          body { background:#0f0f0f; color:white; font-family:Arial; text-align:center; padding:40px; }
          h1 { color:#ff4444; }
        </style>
      </head>
      <body>
        <h1>❌ Payment Canceled</h1>
        <p>Your order was not processed.</p>
        <p>You can return to Telegram and try again anytime.</p>
      </body>
    </html>
  `);
});

app.listen(PORT, () => {
  console.log(`🌐 Server running on port ${PORT}`);
  console.log("✅ Database ready for orders");
});
