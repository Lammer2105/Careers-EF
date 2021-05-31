require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const bot = new TelegramBot(process.env.CAREERS_EF_TOKEN, { polling: true });
const keyboards = require("./keyboards");
const data = require("sqlite-sync");
data.connect("database/careers_ef.db");

var question = {};
var feedback = {};

bot.onText(/\/start/, (msg) => {
  bot.sendMessage(
    msg.from.id,
    "Привіт, можеш задати питання або залишити відгук про канал або бота. На запитання ти можеш отримати відповідь, відгук залишиться без відповіді)",
    keyboards.feedback
  );
});

bot.on("message", (msg) => {
  if (msg.from.id in question) {
    sendFeedback(msg);
    delete feedback[msg.from.id];
  }
});

bot.on("callback_query", (query) => {
  switch (query.data) {
    case "question":
      question[query.from.id] = {};
      bot.sendMessage(
        query.message.chat.id,
        "Надішли питання в чат, та невдовзі отримаєш відповідь"
      );
      break;
    case "feedback":
      feedback[query.from.id] = {};
      bot.sendMessage(
        query.message.chat.id,
        "Будемо раді конструктивній критиці та позитивним відгукам! Напиши своє враження:"
      );
      break;
  }
});

function sendFeedback(msg) {
  const admins = data.run("select * from admins");
  admins.forEach((element) => {
    bot.sendMessage(
      element.chat_id,
      "<b>Відгук від користувача + @" + msg.from.username + "</b>\n" + msg.text,
      { parse_mode: "HTML" }
    );
  });
}
