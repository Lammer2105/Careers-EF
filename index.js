require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const bot = new TelegramBot(process.env.CAREERS_EF_TOKEN, { polling: true });
const keyboards = require("./keyboards");
const data = require("sqlite-sync");
data.connect("database/careers_ef.db");

var question = {};
var feedback = {};
var answer = {};

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
            "Привіт, можеш задати питання або залишити відгук про канал або бота. На запитання ти можеш отримати відповідь,<b> відгук залишиться без відповіді)</b>\nЯкщо ти HR, скористайся останньою кнопкою 😏",
            keyboards.start
          );
          return;
        }
      }
    );
  }
  bot.sendMessage(
    msg.from.id,
    "Можеш задати питання або залишити відгук про канал або бота. На запитання ти можеш отримати відповідь,<b> відгук залишиться без відповіді)</b>",
    keyboards.start
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
  }
  if (msg.from.id in question) {
    sendQuestion(msg);
  }
  if (msg.chat.id in answer) {
    sendAnswer(msg);
  }
});

bot.on("callback_query", (query) => {
  console.log(query.data);
  if (query.data === "question") {
    question[query.message.chat.id] = { message_id: false };
    bot.sendMessage(
      query.message.chat.id,
      "Надішли питання в чат, та невдовзі отримаєш відповідь"
    );
    return;
  }
  if (query.data === "feedback") {
    feedback[query.message.chat.id] = {};
    bot.sendMessage(
      query.message.chat.id,
      "Будемо раді конструктивній критиці та позитивним відгукам! Напиши своє враження:"
    );
    return;
  }

  if (query.data.indexOf(".") != -1) {
    var before_dot = query.data.slice(0, query.data.indexOf("."));
    var after_dot = query.data.slice(
      query.data.indexOf(".") + 1,
      query.data.length
    );
    bot.sendMessage(query.message.chat.id, "Надішліть повідомлення", {
      reply_markup: {
        inline_keyboard: [[{ text: "Скасувати", callback_data: "cancel" }]],
      },
    });
    answer[query.message.chat.id] = {
      user_id: before_dot,
      message_id: after_dot,
    };
  }
});

function sendFeedback(msg) {
  const admins = data.run("select * from admins");
  admins.forEach((element) => {
    bot.sendMessage(
      element.chat_id,
      "<b>Відгук від користувача @" + msg.from.username + "</b>\n\n" + msg.text,
      { parse_mode: "HTML" }
    );
  });
  delete feedback[msg.from.id];
}
function sendQuestion(msg) {
  console.log(msg.message_id);
  const admins = data.run("select * from admins");
  admins.forEach((element) => {
    bot.sendMessage(
      element.chat_id,
      "<b>Повідомлення від користувача @" +
        msg.from.username +
        "</b>\n\n" +
        msg.text,
      {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "Відповісти",
                callback_data: msg.chat.id + "." + msg.message_id,
              },
            ],
          ],
        },
      }
    );
  });
  delete question[msg.from.id];
  bot.sendMessage(
    msg.chat.id,
    "Запитання надіслано. Продовжуємо працювати!",
    keyboards.start
  );
}
function sendAnswer(msg) {
  bot.sendMessage(answer[msg.chat.id].user_id, msg.text, {
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: "Відповісти",
            callback_data: msg.chat.id + "." + msg.message_id,
          },
        ],
      ],
    },
    reply_to_message_id: answer[msg.from.id].message_id,
  });
  bot.sendMessage(msg.chat.id, "Повідомлення надіслано");
  delete answer[msg.chat.id];
}
