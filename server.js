const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const Stripe = require('stripe');

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const stripe = new Stripe(STRIPE_SECRET_KEY);
const DOMAIN = 'https://the-bambir-vinyl-app.onrender.com';

app.get('/', (req, res) => {
  res.send('✅ The Bambir Vinyl bot backend is active.');
});

async function createCheckoutSession(order, amount) {
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [
      {
        price_data: {
          currency: 'usd',
          product_data: { name: `Mankakan Khagher Vinyl x${order.quantity}` },
          unit_amount: (amount * 100) / order.quantity,
        },
        quantity: order.quantity,
      },
    ],
    mode: 'payment',
    success_url: `${DOMAIN}/success`,
    cancel_url: `${DOMAIN}/cancel`,
  });
  return session.url;
}

app.listen(process.env.PORT || 10000, () =>
  console.log(`🌐 Server running on port ${process.env.PORT || 10000}`)
);

module.exports = { createCheckoutSession };
