require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const bot = new TelegramBot(process.env.CAREERS_EF_TOKEN, { polling: true });
const keyboards = require("./keyboards");
const data = require("sqlite-sync");
data.connect("database/careers_ef.db");
const uk = require("./uk.json");
const functions = require("./functions");

var question = {};
var feedback = {};
var answer = {};
var post = {};

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
          bot.sendMessage(msg.chat.id, uk[0].new_start, {
            reply_markup: keyboards.start,
            parse_mode: "HTML",
          });
        }
      }
    );
    return;
  }
  bot.sendMessage(msg.chat.id, uk[0].exists_user_start, {
    reply_markup: keyboards.start,
    parse_mode: "HTML",
  });
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
            "Помилка додавання чату. Чат або вже додано, або він знаходиться в чорному списку"
          );
        } else {
          bot.sendMessage(
            msg.chat.id,
            "Чат додано як адміністратор. Тепер сюди будуть надсилатись відгуки та запитання"
          );
        }
      }
    );
  } else if (match[1] === "delete") {
    data.delete(
      "admins",
      {
        chat_id: parseInt(msg.chat.id),
      },
      (callback) => {
        if (callback.error) {
          bot.sendMessage(
            msg.chat.id,
            "Помилка видалення чату. Напевно чат або вже видалено"
          );
        } else {
          bot.sendMessage(
            msg.chat.id,
            "Чат видалення зі списку адміністраторів. Сюди більше не будуть надсилатись повідомлення з боту"
          );
        }
      }
    );
  } else {
    bot.sendMessage(msg.chat.id, "Невірний пароль");
  }
});

bot.on("message", (msg) => {
  if (msg.chat.id in feedback) {
    sendFeedback(msg);
  }
  if (msg.chat.id in question) {
    sendQuestion(msg);
  }
  if (msg.chat.id in answer) {
    sendAnswer(msg);
  }
  if (msg.chat.id in post) {
    post[msg.chat.id].messages.push(msg.message_id);
    bot.sendMessage(
      msg.chat.id,
      "Повідомлення додано. Надішліть ще або завершіть додавання кнопкою 'Надіслати'. Скасувати додавання - кнопка 'Скасувати'",
      {
        reply_markup: {
          inline_keyboard: [
            [
              { text: "Видалити", callback_data: "delete." + msg.message_id },
              { text: "Cкасувати додавання", callback_data: "cancel" },
            ],
            [{ text: "Надіслати ✔️", callback_data: "send_post" }],
          ],
        },
      }
    );
    return;
  }
});

bot.on("callback_query", (query) => {
  if (query.data === "question") {
    question[query.message.chat.id] = { message_id: false };
    bot.deleteMessage(query.message.chat.id, query.message.message_id);
    bot.sendMessage(
      query.message.chat.id,
      "Надішли питання в чат, та невдовзі отримаєш відповідь",
      {
        reply_markup: keyboards.cancel,
        parse_mode: "HTML",
      }
    );
    return;
  }
  if (query.data === "feedback") {
    feedback[query.message.chat.id] = {};
    bot.deleteMessage(query.message.chat.id, query.message.message_id);
    bot.sendMessage(
      query.message.chat.id,
      "Будемо раді конструктивній критиці та позитивним відгукам! Напиши своє враження:",
      {
        reply_markup: keyboards.cancel,
        parse_mode: "HTML",
      }
    );
    return;
  }
  if (query.data === "cancel") {
    if (
      query.message.chat.id in question ||
      query.message.chat.id in answer ||
      query.message.chat.id in feedback ||
      query.message.chat.id in post
    ) {
      delete question[query.message.chat.id];
      delete answer[query.message.chat.id];
      delete feedback[query.message.chat.id];
      delete post[query.message.chat.id];
      bot.deleteMessage(query.message.chat.id, query.message.message_id);
      bot.sendMessage(
        query.message.chat.id,
        "Дію скасовано\n" + uk[0].exists_user_start,
        {
          reply_markup: keyboards.start,
          parse_mode: "HTML",
        }
      );
    }

    return;
  }

  if (query.data === "post") {
    post[query.message.chat.id] = { messages: [] };
    bot.deleteMessage(query.message.chat.id, query.message.message_id);
    bot.sendMessage(
      query.message.chat.id,
      "Надсилайте декілька повідомлень, а потім натисніть кнопку 'Надіслати ✔️':",
      {
        reply_markup: keyboards.cancel,
      }
    );
    return;
  }
  if (query.data === "send_post") {
    if (query.message.chat.id in post) {
      sendPost(query);
      bot.editMessageText(
        "Повідомлення надіслані до команди Careers EF. Очікуйте підтвердження від команди",
        {
          message_id: query.message.message_id,
          chat_id: query.message.chat.id,
          parse_mode: "HTML",
        }
      );
      bot.sendMessage(msg.chat.id, uk[0].exists_user_start, {
        reply_markup: keyboards.start,
        parse_mode: "HTML",
      });
    } else {
      bot.editMessageText(
        "<b>Спочатку натисніть кнопку 'Запропонувати пост'</b>\n" +
          uk[0].exists_user_start,
        {
          message_id: query.message.message_id,
          chat_id: query.message.chat.id,
          reply_markup: keyboards.start,
          parse_mode: "HTML",
        }
      );
    }
    return;
  }

  if (query.data.indexOf(".") != -1) {
    var before_dot = query.data.slice(0, query.data.indexOf("."));
    var after_dot = query.data.slice(
      query.data.indexOf(".") + 1,
      query.data.length
    );
    if (before_dot === "delete" && query.message.chat.id in post) {
      post[query.message.chat.id].messages.pop();
      bot.deleteMessage(query.message.chat.id, parseInt(after_dot));
      bot.editMessageText(
        "Повідомлення видалено зі списку доданих. Можеш надіслати ще або скасувати. Для надсилання до команди Careers EА тисни кнопку 'Надіслати ✔️'",
        {
          chat_id: query.message.chat.id,
          message_id: query.message.message_id,
          reply_markup: {
            inline_keyboard: [
              [{ text: "Cкасувати додавання", callback_data: "cancel" }],
              [{ text: "Надіслати ✔️", callback_data: "send_post" }],
            ],
          },
        }
      );
      return;
    }
    if (before_dot === "approve") {
      bot.sendMessage(
        query.message.chat.id,
        "Схвалення. Напишіть коментар, якщо він не потрібен, напишіть 0:",
        {
          reply_markup: keyboards.cancel,
        }
      );
      answer[query.message.chat.id] = {
        user_id: parseInt(after_dot),
        message_id: false,
        approve_msg_id: query.message.message_id,
      };
      return;
    }
    if (before_dot === "reject") {
      bot.sendMessage(
        query.message.chat.id,
        "Відхилення. Напишіть коментар, якщо він не потрібен, напишіть 0:",
        {
          reply_markup: keyboards.cancel,
        }
      );
      answer[query.message.chat.id] = {
        user_id: parseInt(after_dot),
        message_id: false,
        reject_msg_id: query.message.message_id,
      };
      return;
    }
    if (
      Number.isInteger(parseInt(before_dot)) &&
      Number.isInteger(parseInt(after_dot))
    ) {
      bot.sendMessage(
        query.message.chat.id,
        "Надішли відповідь на повідомлення:",
        {
          reply_markup: keyboards.cancel,
        }
      );
      answer[query.message.chat.id] = {
        user_id: before_dot,
        message_id: after_dot,
      };
    }
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
  delete feedback[msg.chat.id];
  bot.sendMessage(msg.chat.id, "Відгук надіслано. Дякую!");
  bot.sendMessage(msg.chat.id, uk[0].exists_user_start, {
    reply_markup: keyboards.start,
    parse_mode: "HTML",
  });
}
function sendQuestion(msg) {
  const admins = data.run("select * from admins");
  admins.forEach((element) => {
    bot.sendMessage(
      element.chat_id,
      "<b>Запитання від користувача @" +
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
  delete question[msg.chat.id];
  bot.sendMessage(msg.chat.id, "Запитання надіслано. Продовжуємо працювати!");
  bot.sendMessage(msg.chat.id, uk[0].exists_user_start, {
    reply_markup: keyboards.start,
    parse_mode: "HTML",
  });
}
function sendAnswer(msg) {
  var text = msg.text;
  if (answer[msg.chat.id].approve) {
    text = "<b>Пропозицію схвалено.</b>";
    if (msg.text !== "0") {
      text += " Коментар:\n" + msg.text;
    }
    bot.editMessageReplyMarkup(
      {
        inline_keyboard: [
          [
            {
              text: "✅ Схвалено",
              callback_data: "-",
            },
            {
              text: "Відхилити",
              callback_data: "-",
            },
          ],
        ],
      },
      {
        message_id: answer[msg.chat.id].approve_msg_id,
        chat_id: msg.chat.id,
      }
    );
  }
  if (answer[msg.chat.id].reject) {
    text = "<b>Пропозицію відхилено.</b>";
    if (msg.text !== "0") {
      text += " Коментар:\n" + msg.text;
    }
    bot.editMessageReplyMarkup(
      {
        inline_keyboard: [
          [
            {
              text: "Схвалити",
              callback_data: "-",
            },
            {
              text: "❌ Відхилено",
              callback_data: "-",
            },
          ],
        ],
      },
      {
        message_id: answer[msg.chat.id].reject_msg_id,
        chat_id: msg.chat.id,
      }
    );
  }

  bot.sendMessage(answer[msg.chat.id].user_id, text, {
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
    reply_to_message_id: answer[msg.chat.id].message_id,
    parse_mode: "HTML",
  });
  bot.sendMessage(msg.chat.id, "Відповідь надіслано");
  delete answer[msg.chat.id];
}
async function sendPost(query) {
  const admins = data.run("select * from admins");
  for (admin of admins) {
    await bot.sendMessage(
      admin.chat_id,
      "<b>Пропозиція від HR @" + query.from.username + "</b>",
      { parse_mode: "HTML" }
    );
    functions.sleep(50);

    for (message of post[query.message.chat.id].messages) {
      await bot.forwardMessage(admin.chat_id, query.message.chat.id, message);
    }
    functions.sleep(50);
    await bot.sendMessage(admin.chat_id, "Схвалити пропозицію?", {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "Схвалити",
              callback_data: "approve." + query.message.chat.id,
            },
            {
              text: "Відхилити",
              callback_data: "reject." + query.message.chat.id,
            },
          ],
        ],
      },
    });
  }
  delete post[query.message.chat.id];
}
