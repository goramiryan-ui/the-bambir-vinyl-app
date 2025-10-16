import { Telegraf, Markup } from "telegraf";
import dotenv from "dotenv";
dotenv.config();

const bot = new Telegraf(process.env.BOT_TOKEN);

bot.start((ctx) => {
  ctx.replyWithPhoto(
    "https://images.squarespace-cdn.com/content/v1/5fc8d15fb12b6f2e3ebe1a95/877f9c2a-e18c-48f2-8da2-70a945efcc21/The+Bambir+-+Mankakan+Khagher+-+Childrens+Games.png?format=2500w",
    {
      caption:
        "*Welcome to The Bambir Telegram Shop!*\n\nMankakan Khagher Vinyl is now on sale!\n\nClick below to order your vinyl:",
      parse_mode: "Markdown",
      reply_markup: Markup.inlineKeyboard([
        [Markup.button.webApp("💿 Buy Now", "https://the-bambir-vinyl-app.onrender.com/miniapp.html")],
      ]),
    }
  );
});

bot.launch().then(() => console.log("📱 Telegram bot is listening for messages"));

export default bot;
