const data = require("sqlite-sync");
data.connect("database/careers_ef.db");
require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const bot = new TelegramBot(process.env.CAREERS_EF_TOKEN, { polling: true });

var media_group = {};

bot.onText(/\/start/, (msg) => {
  var keyword = "exist_user";
  if (
    data.run("select count(*) as cnt from users where user_id = ?", [
      msg.chat.id,
    ])[0].cnt == 0
  ) {
    keyword = "new_user";
  }
  register(msg);
  bot.sendMessage(
    msg.chat.id,
    data.run("select * from phrases where keyword = ?", [keyword])[0].content,
    {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard:
          data.run(
            "select count(*) as cnt from admins where rank not null and rank <> 'moderator' and chat_id = ?",
            [msg.chat.id]
          )[0].cnt > 0
            ? adminPanelMenu
            : undefined,
      },
    }
  );
});

bot.onText(/\/admin ([^;'\"]+)/, (msg, match) => {
  addAndDeleteAdminForHimself(msg, match);
});

bot.on("message", (msg) => {
  adminPanel(msg);
  if (msg.entities && (msg.entities[0].type = "bot_command")) {
    return;
  }
  sendAskAndAnswer(msg);
});

bot.on("callback_query", (query) => {
  adminPanel(query);
});

function sendAskAndAnswer(msg) {
  let admins = data.run("select * from admins where rank not null");
  let current_admin = data.run(
    "select * from admins where rank not null and chat_id = ?",
    [msg.chat.id]
  );

  if (
    current_admin.length &&
    msg.reply_to_message &&
    (msg.reply_to_message.entities || msg.reply_to_message.caption_entities)
  ) {
    malling(
      msg,
      msg.text ? msg.text : msg.caption ? msg.caption : "",
      msg.reply_to_message.entities
        ? msg.reply_to_message.entities[0].user.id
        : msg.reply_to_message.caption_entities
        ? msg.reply_to_message.caption_entities[0].user.id
        : NaN
    );
    for (let i = 0; i < admins.length; i++) {
      const another_admin = admins[i];
      if (current_admin[0].chat_id == another_admin.chat_id) continue;
      malling(
        msg,
        (msg.chat.first_name ? msg.chat.first_name : msg.chat.title) +
          " відповів " +
          (msg.reply_to_message.text
            ? msg.reply_to_message.entities[0].user.first_name
            : msg.reply_to_message.caption
            ? msg.reply_to_message.caption_entities[0].user.first_name
            : null) +
          ":\n" +
          (msg.text ? msg.text : msg.caption ? msg.caption : ""),
        another_admin.chat_id
      );
    }
    return;
  }
  if (msg.chat.id == msg.from.id && !current_admin.length) {
    admins.forEach((admin) => {
      malling(
        msg,
        '<a href="tg://user?id=' +
          msg.from.id +
          '">᠌' +
          msg.from.first_name +
          "</a>\n" +
          (msg.text ? msg.text : msg.caption ? msg.caption : ""),
        admin.chat_id
      );
    });
  }
}

//! functions

var mallingMode = {};
var ignore = {};
let adminPanelMenu = [
  [{ text: "« Admin panel »", callback_data: "supermoderator" }],
];
var done_keyboard = [
  [
    {
      text: "☑️ Done",
      callback_data: "done",
    },
  ],
];

function register(msg) {
  if (msg.chat.id == msg.from.id) {
    try {
      data.insert("users", {
        user_id: msg.from.id,
        username: msg.from.username,
        first_name: msg.from.first_name,
      });
    } catch (error) {}
  }
}

function malling(msg, text, chatId) {
  if (msg.media_group_id) {
    var media_element = {
      type: "",
      media: "",
    };
    if (!(chatId in media_group)) {
      media_group[chatId] = {
        files: [],
      };
      media_element.caption = text;
      setTimeout(() => {
        return bot.sendMediaGroup(chatId, media_group[chatId].files);
      }, 5);
      setTimeout(() => {
        delete media_group[chatId];
      }, 6);
    }
    if (msg.document) {
      media_element.type = "document";
      media_element.media = msg.document.file_id;
      media_element.caption = text;
    }
    if (msg.photo) {
      media_element.type = "photo";
      media_element.media = msg.photo.pop().file_id;
    }
    if (msg.video) {
      media_element.type = "video";
      media_element.media = msg.video.file_id;
    }
    if (msg.audio) {
      media_element.type = "audio";
      media_element.media = msg.audio.file_id;
      media_element.caption = text;
    }
    media_element.parse_mode = "HTML";
    media_group[chatId].files.push(media_element);
    return;
  }
  if (msg.text) return bot.sendMessage(chatId, text, { parse_mode: "HTML" });
  if (msg.document)
    return bot.sendDocument(chatId, msg.document.file_id, {
      caption: text,
      parse_mode: "HTML",
    });
  if (msg.voice)
    return bot.sendVoice(chatId, msg.voice.file_id, {
      caption: text,
      parse_mode: "HTML",
    });
  if (msg.audio)
    return bot.sendAudio(chatId, msg.audio.file_id, {
      caption: text,
      parse_mode: "HTML",
    });
  if (msg.video_note) return bot.sendVideoNote(chatId, msg.video_note.file_id);
  if (msg.video)
    return bot.sendVideo(chatId, msg.video.file_id, {
      caption: text,
      parse_mode: "HTML",
    });
  if (msg.sticker) return bot.sendSticker(chatId, msg.sticker.file_id);
  if (msg.photo)
    return bot.sendPhoto(chatId, msg.photo.pop().file_id, {
      caption: text,
      parse_mode: "HTML",
    });
}

function adminPanel(input) {
  var users = data.run("select * from users");
  var chatId = input.data ? input.message.chat.id : input.chat.id;
  var current_admin = data.run(
    "select * from admins where rank not null and rank <> 'moderator' and chat_id = ?",
    [chatId]
  );
  if (current_admin.length) {
    if (!input.data) {
      if (chatId in mallingMode) {
        if (input.text && parseInt(input.text) % 1 === 0) {
          if (
            data.run(
              "select count(*) as cnt from ignorelist where user_id = ?",
              [parseInt(input.text)]
            )[0].cnt > 0 ||
            !(
              data.run("select count(*) as cnt from users where user_id = ?", [
                parseInt(input.text),
              ])[0].cnt > 0
            )
          ) {
            mallingMode[chatId].text =
              mallingMode[chatId].text + "\n<s>" + input.text + "</s> ";
          } else {
            mallingMode[chatId].chats.push(parseInt(input.text));
            mallingMode[chatId].text =
              mallingMode[chatId].text + "\n➕" + input.text + " ";
          }
          bot.editMessageText(mallingMode[chatId].text, {
            message_id: mallingMode[chatId].message_id,
            chat_id: chatId,
            reply_markup: {
              inline_keyboard: mallingMode[chatId].keyboard,
            },
            parse_mode: "HTML",
          });
          return;
        }
        if (input.text && input.text === "all") {
          for (let i = 0; i < users.length; i++) {
            const user = users[i];
            if (
              mallingMode[chatId].chats.indexOf(user.user_id) != -1 ||
              data.run(
                "select count(*) as cnt from ignorelist where user_id = ?",
                [user.user_id]
              )[0].cnt > 0
            )
              continue;
            mallingMode[chatId].chats.push(user.user_id);
          }
          bot.editMessageText(mallingMode[chatId].text + "\nAdded all chats", {
            message_id: mallingMode[chatId].message_id,
            chat_id: chatId,
            reply_markup: {
              inline_keyboard: mallingMode[chatId].keyboard,
            },
          });
          return;
        }
        mallingMode[chatId].text = mallingMode[chatId].text + "\n---\n";
        bot.editMessageText(mallingMode[chatId].text, {
          message_id: mallingMode[chatId].message_id,
          chat_id: chatId,
          reply_markup: {
            inline_keyboard: mallingMode[chatId].keyboard,
          },
        });
        mallingMode[chatId].chats.forEach((malling_chat_id) => {
          malling(
            input,
            input.text ? input.text : input.caption ? input.caption : "᠌",
            malling_chat_id,
            bot
          ).then(
            (onfulfilled) => {
              mallingMode[chatId].text =
                mallingMode[chatId].text + malling_chat_id + " ";
              bot.editMessageText(mallingMode[chatId].text, {
                message_id: mallingMode[chatId].message_id,
                chat_id: chatId,
                reply_markup: {
                  inline_keyboard: mallingMode[chatId].keyboard,
                },
              });
            },
            (onrejected) => {
              if (
                onrejected.response.statusCode == 400 ||
                onrejected.response.statusCode == 403
              ) {
                data.delete("users", { user_id: malling_chat_id });
                data.delete("admins", { chat_id: malling_chat_id });
              }
            }
          );
        });
        return;
      }
      if (chatId in ignore && input.text && parseInt(input.text) % 1 === 0) {
        if (ignore[chatId].adding) {
          data.insert(
            "ignorelist",
            { user_id: parseInt(input.text) },
            (callback) => {
              if (callback.error) {
                ignore[chatId].text = ignore[chatId].text + "\n❌" + input.text;
              } else {
                ignore[chatId].text = ignore[chatId].text + "\n➕" + input.text;
              }
              bot.editMessageText(ignore[chatId].text, {
                message_id: ignore[chatId].message_id,
                chat_id: chatId,
                reply_markup: {
                  inline_keyboard: ignore[chatId].keyboard,
                },
              });
            }
          );
          return;
        }
        if (ignore[chatId].removing) {
          data.delete(
            "ignorelist",
            { user_id: parseInt(input.text) },
            (callback) => {
              if (callback.error) {
                ignore[chatId].text = ignore[chatId].text + "\n❌" + input.text;
              } else {
                ignore[chatId].text = ignore[chatId].text + "\n➖" + input.text;
              }
              bot.editMessageText(ignore[chatId].text, {
                message_id: ignore[chatId].message_id,
                chat_id: chatId,
                reply_markup: {
                  inline_keyboard: ignore[chatId].keyboard,
                },
              });
            }
          );
          return;
        }
      }
      if (current_admin[0].rank == "god") {
        // search by users
        let user = [];
        var text = "";
        if (parseInt(input.text) % 1 === 0) {
          user = data.run("select * from users where user_id = ?", [
            parseInt(input.text),
          ]);
        } else if (input.text.indexOf("@") != -1) {
          let username = input.text.slice(
            input.text.indexOf("@") + 1,
            input.text.length
          );
          user = data.run("select * from users where user_username like ?", [
            username,
          ]);
        } else {
          user = data.run("select * from users where first_name like ?", [
            input.text,
          ]);
        }
        if (!user.length) return;
        bot.deleteMessage(chatId, input.message_id);
        user.forEach((user_element) => {
          text +=
            '<a href="tg://user?id=' +
            (user_element.user_id
              ? user_element.user_id
              : user_element.chat_id) +
            '">' +
            user_element.first_name +
            "</a> " +
            (user_element.user_id
              ? user_element.user_id
              : user_element.chat_id) +
            "\n";
        });
        bot.sendMessage(chatId, text, { parse_mode: "HTML" });
        return;
      }
    }
    if (input.data) {
      if (input.data == "supermoderator") {
        var text = "Admin panel";
        bot.editMessageText(
          text +
            "\n" +
            (current_admin[0].rank == "god" ? process.env.PASSWORD : ""),
          {
            chat_id: chatId,
            parse_mode: "HTML",
            message_id: input.message.message_id,
            reply_markup: { inline_keyboard: keyboardForSuperadmin() },
          }
        );
        return;
      }

      if (input.data.indexOf("&") != -1) {
        let query = input.data.slice(0, input.data.indexOf("&"));
        users = data.run(`select * from ${query}`);
        let page = parseInt(
          input.data.slice(input.data.indexOf("&") + 1, input.data.length)
        );
        let users_count = users.length;
        users = data.run(`select * from ${query} limit ${page * 50}, 50`);
        var text = users_count + ` ${query}\n`;
        var row = 0;
        var keyboard = [[]];
        for (let i = 0; i < users.length; i++) {
          const user = users[i];
          text +=
            '<a href="tg://user?id=' +
            (query == "admins" ? user.chat_id : user.user_id) +
            '">' +
            (query == "admins"
              ? user.first_name
              : data.run("select first_name from users where user_id = ?", [
                  user.user_id,
                ])[0].first_name) +
            "</a> " +
            (query == "admins" ? user.chat_id : user.user_id) +
            (query == "admins" ? " " + user.rank : "") +
            "\n";
          if (current_admin[0].rank === "god" && query == "admins") {
            if (user.rank === "god") continue;
            if ((i - 1) % 2 == 0) {
              row++;
              keyboard.push([]);
            }
            keyboard[row].push({
              text:
                query == "ignorelist"
                  ? data.run("select first_name from users where user_id = ?", [
                      user.user_id,
                    ])[0].first_name
                  : user.first_name,
              callback_data: user.chat_id,
            });
          }
        }

        if (page > 0) {
          keyboard[0].push({
            text: "⏮",
            callback_data: query + "&0",
          });
          keyboard[0].push({
            text: "⏪",
            callback_data: query + "&" + (page - 1),
          });
        }
        if (page < parseInt(users_count / 50)) {
          keyboard[0].push({
            text: "⏩",
            callback_data: query + "&" + (page + 1),
          });
          keyboard[0].push({
            text: "⏭",
            callback_data: query + "&" + parseInt(users_count / 50),
          });
        }
        if (query == "users") {
          keyboard.push([]);
          if (data.run("select count(*) as cnt from ignorelist")[0].cnt > 0) {
            keyboard[1].push({
              text: "📃 Ignore list",
              callback_data: "ignorelist&0",
            });
          }
          keyboard[1].push({ text: "📩 Malling", callback_data: "malling" });
          keyboard.push([]);
          keyboard[2].push({
            text: "➕ Add user to ignore list",
            callback_data: "ignore%add",
          });
        }
        if (
          query == "ignorelist" &&
          data.run("select count(*) as cnt from ignorelist")[0].cnt > 0
        )
          keyboard.push([
            {
              text: "🧑‍💻 Users",
              callback_data: "users&0",
            },
            {
              text: "➖ Remove user from list",
              callback_data: "ignore%remove",
            },
          ]);
        keyboard.push(adminPanelMenu[0]);
        bot.editMessageText(String(text), {
          chat_id: chatId,
          parse_mode: "HTML",
          message_id: input.message.message_id,
          reply_markup: {
            inline_keyboard: keyboard,
          },
        });
        return;
      }
      if (input.data.indexOf("%") != -1) {
        var before_dot = input.data.slice(0, input.data.indexOf("%"));
        var after_dot = input.data.slice(
          input.data.indexOf("%") + 1,
          input.data.length
        );
        if (after_dot == "add") {
          ignore[chatId] = { adding: true };
          bot
            .sendMessage(chatId, "Send user id (adding users to ignorelist)", {
              reply_markup: {
                inline_keyboard: done_keyboard,
              },
            })
            .then((onfulfilled) => {
              ignore[chatId].message_id = onfulfilled.message_id;
              ignore[chatId].text = onfulfilled.text;
              ignore[chatId].keyboard =
                onfulfilled.reply_markup.inline_keyboard;
            });
        }
        if (after_dot == "remove") {
          ignore[chatId] = { removing: true };
          ignore[chatId].parent_message_id = input.message.message_id;
          bot
            .sendMessage(
              chatId,
              "Send user id (removing users from ignorelist)",
              {
                reply_markup: {
                  inline_keyboard: [
                    [
                      {
                        text: "🗑 Remove all users",
                        callback_data: "ignore%removeall",
                      },
                      done_keyboard[0][0],
                    ],
                  ],
                },
              }
            )
            .then((onfulfilled) => {
              ignore[chatId].message_id = onfulfilled.message_id;
              ignore[chatId].text = onfulfilled.text;
              ignore[chatId].keyboard =
                onfulfilled.reply_markup.inline_keyboard;
            });
        }
        if (after_dot == "removeall") {
          bot.deleteMessage(chatId, input.message.message_id);
          data.run("select * from ignorelist").forEach((ignoreuser) => {
            data.delete("ignorelist", { user_id: ignoreuser.user_id });
          });
          bot.editMessageText("all users deleted from ignorelist", {
            chat_id: chatId,
            parse_mode: "HTML",
            message_id: ignore[chatId].parent_message_id,
            reply_markup: {
              inline_keyboard: me,
            },
          });
          delete ignore[chatId];
        }
        return;
      }

      if (input.data == "malling") {
        mallingMode[chatId] = { chats: [] };
        bot
          .sendMessage(
            chatId,
            "Send chatId, or all, if you want send message to all users",
            {
              reply_markup: {
                inline_keyboard: done_keyboard,
              },
            }
          )
          .then((onfulfilled) => {
            mallingMode[chatId].message_id = onfulfilled.message_id;
            mallingMode[chatId].text = onfulfilled.text;
            mallingMode[chatId].keyboard =
              onfulfilled.reply_markup.inline_keyboard;
          });
        return;
      }

      if (input.data == "done") {
        var keyboard = [[]];
        var mode = {};
        if (chatId in mallingMode) {
          keyboard = [[{ text: "📩 Malling", callback_data: "malling" }]];
          mallingMode[chatId].text += "\n/start";
          mode = mallingMode;
        }
        if (chatId in ignore) {
          if (ignore[chatId].adding)
            keyboard = [
              [{ text: "➕ Add user to list", callback_data: "ignore%add" }],
            ];
          if (ignore[chatId].removing)
            keyboard = [
              [
                {
                  text: "➖ Remove user from list",
                  callback_data: "ignore%remove",
                },
              ],
            ];
          ignore[chatId].text += "\n/start";
          mode = ignore;
        }
        bot.editMessageText(mode[chatId].text, {
          chat_id: chatId,
          parse_mode: "HTML",
          message_id: input.message.message_id,
          reply_markup: {
            inline_keyboard: keyboard,
          },
        });
        delete mallingMode[chatId];
        delete ignore[chatId];
        return;
      }

      //! before and after dot input
      var before_dot = input.data.slice(0, input.data.indexOf("."));
      var after_dot = parseInt(
        input.data.slice(input.data.indexOf(".") + 1, input.data.length)
      );
      var admin = data.run(
        `select * from admins where chat_id = ${input.data}`
      );
      if (current_admin[0].rank != "god") return;
      if (admin.length) {
        bot.editMessageText(
          data.run("select * from users where user_id = ?", [
            admin[0].chat_id,
          ])[0].length
            ? "@" +
                data.run("select * from users where user_id = ?", [
                  admin[0].chat_id,
                ])[0].username
            : "" + " " + admin[0].first_name + " rank: " + admin[0].rank,
          {
            parse_mode: "HTML",
            chat_id: chatId,
            message_id: input.message.message_id,
            reply_markup: {
              inline_keyboard: keyboardForGod(admin[0].chat_id),
            },
          }
        );
        return;
      }
      admin = data.run(`select * from admins where chat_id = ${after_dot}`)[0];
      if (before_dot === "tonull") {
        var text =
          "@" +
          admin.username +
          " " +
          admin.first_name +
          " rank: null" +
          "\nsucces, null";

        if (admin && admin.rank == null) {
          text =
            "@" +
            admin.username +
            " " +
            admin.first_name +
            " rank: " +
            admin.rank +
            " rank: null" +
            "\nallready null";
        }
        data.update("admins", { rank: null }, { chat_id: after_dot });
        bot.editMessageText(text, {
          parse_mode: "HTML",
          chat_id: chatId,
          message_id: input.message.message_id,
          reply_markup: {
            inline_keyboard: keyboardForGod(after_dot),
          },
        });
        return;
      }

      if (before_dot === "tosuper") {
        var text =
          "@" +
          admin.username +
          " " +
          admin.first_name +
          " rank: supermoderator" +
          "\nsucces, to supermoderator";
        if (admin && admin.rank == "supermoderator") {
          text =
            "@" +
            admin.username +
            " " +
            admin.first_name +
            " rank: supermoderator" +
            "\nalready supermoderator";
        }
        data.update(
          "admins",
          { rank: "supermoderator" },
          { chat_id: after_dot }
        );
        bot.editMessageText(text, {
          parse_mode: "HTML",
          chat_id: chatId,
          message_id: input.message.message_id,
          reply_markup: {
            inline_keyboard: keyboardForGod(after_dot),
          },
        });
        return;
      }
      if (before_dot === "tomoderator") {
        var text =
          "@" +
          admin.username +
          " " +
          admin.first_name +
          " rank: moderator" +
          "\nsucces, to moderator";
        if (admin && admin.rank == "moderator") {
          text =
            "@" +
            admin.username +
            " " +
            admin.first_name +
            " rank: moderator" +
            "\nallready moderator";
        }
        data.update("admins", { rank: "moderator" }, { chat_id: after_dot });
        bot.editMessageText(text, {
          parse_mode: "HTML",
          chat_id: chatId,
          message_id: input.message.message_id,
          reply_markup: {
            inline_keyboard: keyboardForGod(after_dot),
          },
        });
        return;
      }
      if (before_dot == "deleteadmin") {
        var name = data.run("select * from admins where chat_id = ?", [
          after_dot,
        ])[0].first_name;
        data.delete("admins", { chat_id: after_dot });
        bot.editMessageText("Admin " + name + " deleted", {
          chat_id: chatId,
          message_id: input.message.message_id,
          reply_markup: {
            inline_keyboard: keyboardForSuperadmin(),
          },
        });
        return;
      }
    }
  }
  return "end";
}

function addAndDeleteAdminForHimself(msg, match) {
  if (match[1] === process.env.PASSWORD) {
    if (
      data.run("select count(*) as cnt from admins where chat_id = ?", [
        msg.chat.id,
      ])[0].cnt == 0
    ) {
      data.insert("admins", {
        chat_id: msg.chat.id,
        rank: "moderator",
        first_name:
          msg.chat.first_name != null ? msg.chat.first_name : msg.chat.title,
      });
      data
        .run(
          "select * from admins where rank = 'supermoderator' or rank = 'god'"
        )
        .forEach((element) => {
          bot.sendMessage(
            element.chat_id,
            'New admin <a href="tg://user?id=' +
              msg.chat.id +
              '">' +
              msg.chat.first_name !=
              null
              ? msg.chat.first_name
              : msg.chat.title + "</a>",
            {
              parse_mode: "HTML",
              reply_markup:
                element.rank == "god"
                  ? {
                      inline_keyboard: keyboardForGod(msg.chat.id),
                    }
                  : false,
            }
          );
        });
      bot.sendMessage(
        msg.chat.id,
        "Чат додано як адміністратор. Для відміни введіть команду /admin delete",
        { parse_mode: "HTML" }
      );
    } else {
      bot.sendMessage(
        msg.chat.id,
        "Чат вже додавався раніше. Зверніться до адміністратора для вирішення питання"
      );
    }
  } else if (match[1] === "delete") {
    data.update(
      "admins",
      { rank: null },
      {
        chat_id: parseInt(msg.chat.id),
      }
    );
    bot.sendMessage(msg.chat.id, "Чат видалено зі списку адміністраторів.", {
      parse_mode: "HTML",
    });
  } else {
    bot.sendMessage(msg.chat.id, "Невірний пароль");
  }
}

function keyboardForSuperadmin() {
  var keyboard = [
    [
      {
        text: "😎 Admins",
        callback_data: "admins&0",
      },
      {
        text: "🧑‍💻 Users",
        callback_data: "users&0",
      },
    ],
  ];
  return keyboard;
}

function keyboardForGod(chat_id) {
  var keyboard = [[]];
  let admin = data.run("select * from admins where chat_id = ?", [chat_id]);
  if (admin.length) {
    keyboard = [
      [
        {
          text:
            admin[0].rank == "supermoderator"
              ? "⬇️ To moderator"
              : "⬆️ To supermoderator",
          callback_data:
            admin[0].rank == "supermoderator"
              ? "tomoderator." + chat_id
              : "tosuper." + chat_id,
        },
        {
          text: "❌ To null",
          callback_data: "tonull." + chat_id,
        },
      ],
    ];
    if (admin[0].rank == null) {
      keyboard = [
        [
          {
            text: "⬆️ To moderator",
            callback_data: "tomoderator." + chat_id,
          },
        ],
      ];
    }
    keyboard.push([
      { text: "🗑 Delete admin", callback_data: "deleteadmin." + chat_id },
      {
        text: "« Назад",
        callback_data: "admins&0",
      },
    ]);
  }
  return keyboard;
}

function createTables() {
  data.run(
    `create table if not exists admins(
        chat_id bigint primary key,
        rank text,
        first_name text
    )`,
    (callback) => {
      if (callback.error) {
        console.log("failed");
      } else console.log("succes");
    }
  );
  data.run(
    `create table if not exists users(
        user_id bigint primary key,
        username text,
        first_name text
    )`,
    (callback) => {
      if (callback.error) {
        console.log("failed");
      } else console.log("succes");
    }
  );
  data.run(
    `create table if not exists phrases(
        keyword text primary key,
        content text
    )`,
    (callback) => {
      if (callback.error) {
        console.log("failed");
      } else console.log("succes");
    }
  );
  data.run(
    `create table if not exists ignorelist(
        user_id bigint primary key
    )`,
    (callback) => {
      if (callback.error) {
        console.log("failed ignorelist");
      } else console.log("succes ignorelist");
    }
  );
}
