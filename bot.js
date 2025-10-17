import { Telegraf, Markup } from "telegraf";
import dotenv from "dotenv";
dotenv.config();

const bot = new Telegraf(process.env.BOT_TOKEN);
const userSessions = {}; // store user answers temporarily

// START COMMAND
bot.start(async (ctx) => {
  await ctx.replyWithPhoto(
    {
      url: "https://images.squarespace-cdn.com/content/v1/5fc8d15fb12b6f2e3ebe1a95/877f9c2a-e18c-48f2-8da2-70a945efcc21/The+Bambir+-+Mankakan+Khagher+-+Childrens+Games.png?format=2500w",
    },
    {
      caption:
        "🎸 *Welcome to The Bambir Telegram Shop!*\n\n" +
        "Mankakan Khagher Vinyl is now on sale!\n\n" +
        "Click below to order your vinyl:",
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [[{ text: "🛒 Buy Now", callback_data: "start_order" }]],
      },
    }
  );
});

// ORDER FLOW START
bot.action("start_order", async (ctx) => {
  const userId = ctx.from.id;
  userSessions[userId] = {};
  await ctx.answerCbQuery();
  await ctx.reply("📝 Please enter your *full name*:", { parse_mode: "Markdown" });
  userSessions[userId].step = "name";
});

// TEXT INPUT HANDLER
bot.on("text", async (ctx) => {
  const userId = ctx.from.id;
  const text = ctx.message.text;
  const session = userSessions[userId];

  if (!session || !session.step) return;

  switch (session.step) {
    case "name":
      session.name = text.trim();
      session.step = "quantity";
      await ctx.reply("🎚️ Choose quantity:", {
        reply_markup: {
          inline_keyboard: [
            [
              { text: "1", callback_data: "q_1" },
              { text: "2", callback_data: "q_2" },
              { text: "3", callback_data: "q_3" },
              { text: "6+", callback_data: "q_custom" },
            ],
          ],
        },
      });
      break;

    case "custom_qty":
      if (isNaN(text) || Number(text) < 1) {
        await ctx.reply("❌ Please enter a valid number.");
      } else {
        session.quantity = Number(text);
        session.step = "phone";
        await ctx.reply("📞 Enter your *phone number* (digits only, at least 9):", {
          parse_mode: "Markdown",
        });
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
      session.address = text.trim();
      session.step = null;
      const total = (session.quantity || 1) * 20;

      await ctx.reply(
        `✅ *Order Summary:*\n\n` +
          `👤 Name: ${session.name}\n` +
          `📀 Quantity: ${session.quantity}\n` +
          `📞 Phone: ${session.phone}\n` +
          `🏠 Address: ${session.address}\n` +
          `💰 Total: $${total}`,
        {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "💳 Pay Now",
                  web_app: {
                    // ✅ Fixed URL: miniapp.html instead of /checkout
                    url: `https://the-bambir-vinyl-app.onrender.com/miniapp.html?name=${encodeURIComponent(
                      session.name
                    )}&quantity=${session.quantity}&phone=${encodeURIComponent(
                      session.phone
                    )}&address=${encodeURIComponent(session.address)}`,
                  },
                },
              ],
            ],
          },
        }
      );
      break;
  }
});

// INLINE BUTTON HANDLERS
bot.action(/q_(\d+)/, async (ctx) => {
  const qty = Number(ctx.match[1]);
  const userId = ctx.from.id;
  userSessions[userId].quantity = qty;
  userSessions[userId].step = "phone";
  await ctx.answerCbQuery();
  await ctx.reply("📞 Enter your *phone number* (digits only, at least 9):", { parse_mode: "Markdown" });
});

bot.action("q_custom", async (ctx) => {
  const userId = ctx.from.id;
  userSessions[userId].step = "custom_qty";
  await ctx.answerCbQuery();
  await ctx.reply("✏️ Enter your desired quantity number:");
});

bot.launch().then(() => console.log("🤖 Bot running perfectly — Buy Now then Pay Now flow ready!"));

export default bot;
