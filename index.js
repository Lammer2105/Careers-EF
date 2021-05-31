require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const bot = new TelegramBot(process.env.CAREERS_EF_TOKEN, { polling: true });
const keyboards = require("./keyboards");
const data = require("sqlite-sync");
data.connect("database/careers_ef.db");

var question = {};
var feedback = {};

bot.onText(/\/start/, (msg) => {
  if (
    data.run("select count (*) as cnt from users where user_id = ?", [
      msg.from.id,
    ])[0].cnt == 0
  ) {
    data.insert(
      "users",
      {
        user_id: msg.from.id,
        username: msg.from.username,
        first_name: msg.from.first_name,
      },
      (callback) => {
        if (callback.error) {
          bot.sendMessage(msg.chat.id, "Помилка");
        } else {
          bot.sendMessage(
            msg.from.id,
            "Привіт, можеш задати питання або залишити відгук про канал або бота. На запитання ти можеш отримати відповідь,<b> відгук залишиться без відповіді)</b>",
            keyboards.feedback
          );
        }
      }
    );
  }
  bot.sendMessage(
    msg.from.id,
    "Можеш задати питання або залишити відгук про канал або бота. На запитання ти можеш отримати відповідь,<b> відгук залишиться без відповіді)</b>",
    keyboards.feedback
  );
});

bot.onText(/\/admin ([^;'\"]+)/, (msg, match) => {
  if (match[1] === process.env.PASSWORD) {
    data.insert(
      "admins",
      {
        chat_id: parseInt(msg.chat.id),
      },
      (callback) => {
        if (callback.error) {
          bot.sendMessage(
            msg.chat.id,
            "Чат додано як адміністратор. Тепер сюди будуть надсилатись відгуки та запитання"
          );
        } else {
          bot.sendMessage(
            msg.chat.id,
            "Помилка додавання чату. Чат або вже додано, або він знаходиться в чорному списку"
          );
        }
      }
    );
  } else {
    bot.sendMessage(msg.chat.id, "Невірний пароль");
  }
});

bot.on("message", (msg) => {
  if (msg.from.id in feedback) {
    sendFeedback(msg);
    delete feedback[msg.from.id];
  }
  if (msg.from.id in question) {
  }
});

bot.on("callback_query", (query) => {
  switch (query.data) {
    case "question":
      question[query.message.chat.id] = {};
      bot.sendMessage(
        query.message.chat.id,
        "Надішли питання в чат, та невдовзі отримаєш відповідь"
      );
      break;
    case "feedback":
      feedback[query.message.chat.id] = {};
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
      "<b>Відгук від користувача @" + msg.from.username + "</b>\n" + msg.text,
      { parse_mode: "HTML" }
    );
  });
}
