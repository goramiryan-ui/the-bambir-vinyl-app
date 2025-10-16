import express from "express";
import dotenv from "dotenv";
import Stripe from "stripe";
import cors from "cors";

dotenv.config();
const app = express();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

// ✅ Direct redirect endpoint
app.get("/checkout", async (req, res) => {
  try {
    const { name, quantity, phone, address } = req.query;
    const totalQuantity = parseInt(quantity) || 1;
    const amount = totalQuantity * 2000; // $20 per vinyl in cents

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: "Mankakan Khagher Vinyl",
              description: `Order by ${name}, Phone: ${phone}, Address: ${address}`,
            },
            unit_amount: 2000, // $20 per item
          },
          quantity: totalQuantity,
        },
      ],
      success_url: "https://t.me/GA_Test_Eccomerce_bot",
      cancel_url: "https://t.me/GA_Test_Eccomerce_bot",
    });

    // 🔁 Redirect user to Stripe checkout
    res.redirect(session.url);
  } catch (error) {
    console.error("Stripe checkout error:", error);
    res.status(500).send("Failed to create checkout session");
  }
});

// Default port for Render
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🌐 Server running on port ${PORT}`));
