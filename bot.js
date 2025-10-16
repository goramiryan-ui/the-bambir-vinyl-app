import { Telegraf, Markup } from "telegraf";
import dotenv from "dotenv";
dotenv.config();

const bot = new Telegraf(process.env.BOT_TOKEN);

// Temporary user session store (in-memory)
const userSessions = {};

bot.start((ctx) => {
  ctx.replyWithPhoto(
    {
      url: "https://images.squarespace-cdn.com/content/v1/5fc8d15fb12b6f2e3ebe1a95/877f9c2a-e18c-48f2-8da2-70a945efcc21/The+Bambir+-+Mankakan+Khagher+-+Childrens+Games.png?format=2500w",
    },
    {
      caption:
        "*Welcome to The Bambir Telegram Shop!*\n\n" +
        "Mankakan Khagher Vinyl is now on sale!\n\n" +
        "Click below to start your order:",
      parse_mode: "Markdown",
      reply_markup: Markup.inlineKeyboard([
        [Markup.button.callback("🛒 Order Now", "start_order")],
      ]),
    }
  );
});

bot.action("start_order", async (ctx) => {
  const userId = ctx.from.id;
  userSessions[userId] = {};
  await ctx.reply("📝 Please enter your *full name*:", { parse_mode: "Markdown" });
  userSessions[userId].step = "name";
});

bot.on("text", async (ctx) => {
  const userId = ctx.from.id;
  const text = ctx.message.text;

  if (!userSessions[userId] || !userSessions[userId].step) return;

  const session = userSessions[userId];

  switch (session.step) {
    case "name":
      session.name = text;
      session.step = "quantity";
      await ctx.reply("🎚️ Choose quantity:", {
        reply_markup: Markup.inlineKeyboard([
          [Markup.button.callback("1", "q_1"), Markup.button.callback("2", "q_2"), Markup.button.callback("3", "q_3")],
          [Markup.button.callback("6+", "q_custom")],
        ]),
      });
      break;

    case "custom_qty":
      if (isNaN(text) || Number(text) < 1) {
        await ctx.reply("❌ Please enter a valid number.");
      } else {
        session.quantity = Number(text);
        session.step = "phone";
        await ctx.reply("📞 Enter your *phone number* (digits only, at least 9):", { parse_mode: "Markdown" });
      }
      break;

    case "phone":
      if (!/^\d{9,}$/.test(text)) {
        await ctx.reply("❌ Please enter a valid phone number (digits only, at least 9).");
      } else {
        session.phone = text;
        session.step = "address";
        await ctx.reply("🏠 Enter your *delivery address*:", { parse_mode: "Markdown" });
      }
      break;

    case "address":
      session.address = text;
      session.step = null;

      const total = (session.quantity || 1) * 20;

      await ctx.reply(
        `✅ *Order summary:*\n\n` +
          `👤 Name: ${session.name}\n` +
          `📀 Quantity: ${session.quantity}\n` +
          `📞 Phone: ${session.phone}\n` +
          `🏠 Address: ${session.address}\n` +
          `💰 Total: $${total}`,
        {
          parse_mode: "Markdown",
          reply_markup: Markup.inlineKeyboard([
            [Markup.button.webApp("💳 Pay Now", "https://the-bambir-vinyl-app.onrender.com/miniapp.html")],
          ]),
        }
      );
      break;
  }
});

bot.action(/q_(\d+)/, async (ctx) => {
  const qty = Number(ctx.match[1]);
  const userId = ctx.from.id;
  userSessions[userId].quantity = qty;
  userSessions[userId].step = "phone";
  await ctx.reply("📞 Enter your *phone number* (digits only, at least 9):", { parse_mode: "Markdown" });
});

bot.action("q_custom", async (ctx) => {
  const userId = ctx.from.id;
  userSessions[userId].step = "custom_qty";
  await ctx.reply("✏️ Enter your desired quantity number:");
});

bot.launch().then(() => console.log("🤖 Bot running: collects data before Stripe"));

export default bot;
