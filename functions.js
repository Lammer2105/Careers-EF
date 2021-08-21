const data = require("sqlite-sync");
data.connect("database/careers_ef.db");
let adminPanelMenu = [
  [{ text: "« Admin panel »", callback_data: "supermoderator" }],
];
module.exports = {
  adminPanelMenu: adminPanelMenu,
  sleep: function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  },
  sleep2: function sleep(milliseconds) {
    const date = Date.now();
    let currentDate = null;
    do {
      currentDate = Date.now();
    } while (currentDate - date < milliseconds);
  },

  register: (input) => {
    if (input.chat.id == input.from.id) {
      try {
        data.insert("users", {
          user_id: input.from.id,
          username: input.from.username,
          first_name: input.from.first_name,
        });
      } catch (error) {}
    }
  },

  malling: (msg, text, chatId, workingBot) => {
    if (msg.text)
      return workingBot.sendMessage(chatId, text, { parse_mode: "HTML" });
    if (msg.document)
      return workingBot.sendDocument(chatId, msg.document.file_id, {
        caption: text,
        parse_mode: "HTML",
      });
    if (msg.voice)
      return workingBot.sendVoice(chatId, msg.voice.file_id, {
        caption: text,
        parse_mode: "HTML",
      });
    if (msg.video_note)
      return workingBot.sendVideoNote(chatId, msg.video_note.file_id);
    if (msg.video)
      return workingBot.sendVideo(chatId, msg.video.file_id, {
        caption: text,
        parse_mode: "HTML",
      });
    if (msg.sticker) return workingBot.sendSticker(chatId, msg.sticker.file_id);
    if (msg.photo)
      return workingBot.sendPhoto(chatId, msg.photo.pop().file_id, {
        caption: text,
        parse_mode: "HTML",
      });
    return "success";
  },

  adminPanel: function adminPanel(input, mainBot) {
    var users = data.run("select * from users");
    var chatId = input.data ? input.message.chat.id : input.chat.id;
    var current_admin = data.run(
      "select * from admins where rank not null and rank <> 'moderator' and chat_id = ?",
      [chatId]
    );
    if (current_admin.length) {
      if (!input.data) {
        if (chatId in malling) {
          if (input.text && parseInt(input.text) % 1 === 0) {
            if (
              data.run(
                "select count(*) as cnt from ignorelist where user_id = ?",
                [parseInt(input.text)]
              )[0].cnt > 0 ||
              !(
                data.run(
                  "select count(*) as cnt from users where user_id = ?",
                  [parseInt(input.text)]
                )[0].cnt > 0
              )
            ) {
              malling[chatId].text =
                malling[chatId].text + "\n<s>" + input.text + "</s> ";
            } else {
              malling[chatId].chats.push(parseInt(input.text));
              malling[chatId].text =
                malling[chatId].text + "\n➕" + input.text + " ";
            }
            mainBot.editMessageText(malling[chatId].text, {
              message_id: malling[chatId].message_id,
              chat_id: chatId,
              reply_markup: {
                inline_keyboard: malling[chatId].keyboard,
              },
              parse_mode: "HTML",
            });
            return;
          }
          if (input.text && input.text === "all") {
            for (let i = 0; i < users.length; i++) {
              const user = users[i];
              if (
                malling[chatId].chats.indexOf(user.user_id) != -1 ||
                data.run(
                  "select count(*) as cnt from ignorelist where user_id = ?",
                  [user.user_id]
                )[0].cnt > 0
              )
                continue;
              malling[chatId].chats.push(user.user_id);
            }
            mainBot.editMessageText(
              malling[chatId].text + "\nAdded all chats",
              {
                message_id: malling[chatId].message_id,
                chat_id: chatId,
                reply_markup: {
                  inline_keyboard: malling[chatId].keyboard,
                },
              }
            );
            return;
          }
          malling[chatId].text = malling[chatId].text + "\n---\n";
          mainBot.editMessageText(malling[chatId].text, {
            message_id: malling[chatId].message_id,
            chat_id: chatId,
            reply_markup: {
              inline_keyboard: malling[chatId].keyboard,
            },
          });
          malling[chatId].chats.forEach((malling_chat_id) => {
            mallingFunc(
              input,
              input.text ? input.text : input.caption ? input.caption : "᠌",
              malling_chat_id,
              mainBot
            ).then(
              (onfulfilled) => {
                malling[chatId].text =
                  malling[chatId].text + malling_chat_id + " ";
                mainBot.editMessageText(malling[chatId].text, {
                  message_id: malling[chatId].message_id,
                  chat_id: chatId,
                  reply_markup: {
                    inline_keyboard: malling[chatId].keyboard,
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
                  ignore[chatId].text =
                    ignore[chatId].text + "\n❌" + input.text;
                } else {
                  ignore[chatId].text =
                    ignore[chatId].text + "\n➕" + input.text;
                }
                mainBot.editMessageText(ignore[chatId].text, {
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
                  ignore[chatId].text =
                    ignore[chatId].text + "\n❌" + input.text;
                } else {
                  ignore[chatId].text =
                    ignore[chatId].text + "\n➖" + input.text;
                }
                mainBot.editMessageText(ignore[chatId].text, {
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
          mainBot.deleteMessage(chatId, input.message_id);
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
          mainBot.sendMessage(chatId, text, { parse_mode: "HTML" });
          return;
        }
      }
      if (input.data) {
        if (input.data == "supermoderator") {
          var text = "Admin panel";
          mainBot.editMessageText(
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
              (user.user_id ? user.user_id : user.chat_id) +
              '">' +
              (query == "admins"
                ? user.first_name
                : data.run("select first_name from users where user_id = ?", [
                    user.user_id,
                  ])[0].first_name) +
              "</a> " +
              (user.user_id ? user.user_id : user.chat_id) +
              (query == "admins" ? " " + user.rank : "") +
              "\n";
            if (current_admin[0].rank === "god" && query == "admins") {
              if (user.rank === "god") continue;
              if ((i - 1) % 2 == 0) {
                row++;
                keyboard.push([]);
              }
              keyboard[row].push({
                text: user.first_name,
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
          mainBot.editMessageText(text, {
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
            mainBot
              .sendMessage(
                chatId,
                "Send user id (adding users to ignorelist)",
                {
                  reply_markup: {
                    inline_keyboard: done_keyboard,
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
          if (after_dot == "remove") {
            ignore[chatId] = { removing: true };
            ignore[chatId].parent_message_id = input.message.message_id;
            mainBot
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
            mainBot.deleteMessage(chatId, input.message.message_id);
            data.run("select * from ignorelist").forEach((ignoreuser) => {
              data.delete("ignorelist", { user_id: ignoreuser.user_id });
            });
            mainBot.editMessageText("all users deleted from ignorelist", {
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
          malling[chatId] = { chats: [] };
          mainBot
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
              malling[chatId].message_id = onfulfilled.message_id;
              malling[chatId].text = onfulfilled.text;
              malling[chatId].keyboard =
                onfulfilled.reply_markup.inline_keyboard;
            });
          return;
        }

        if (input.data == "done") {
          var keyboard = [[]];
          var mode = {};
          if (chatId in malling) {
            keyboard = [[{ text: "📩 Malling", callback_data: "malling" }]];
            malling[chatId].text += "\n/start";
            mode = malling;
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
          mainBot.editMessageText(mode[chatId].text, {
            chat_id: chatId,
            parse_mode: "HTML",
            message_id: input.message.message_id,
            reply_markup: {
              inline_keyboard: keyboard,
            },
          });
          delete malling[chatId];
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
          mainBot.editMessageText(
            "@" +
              admin[0].username +
              " " +
              admin[0].first_name +
              " rank: " +
              admin[0].rank,
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
        admin = data.run(
          `select * from admins where chat_id = ${after_dot}`
        )[0];
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
          mainBot.editMessageText(text, {
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
          mainBot.editMessageText(text, {
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
          mainBot.editMessageText(text, {
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
          mainBot.editMessageText("Admin " + name + " deleted", {
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
  },

  addAndDeleteAdminForHimself: (msg, match, mainBot) => {
    if (match[1] === process.env.PASSWORD) {
      if (
        data.run("select count(*) as cnt from admins where chat_id = ?", [
          msg.chat.id,
        ])[0].cnt == 0
      ) {
        data.insert("admins", {
          chat_id: msg.chat.id,
          rank: "moderator",
        });
        data
          .run(
            "select * from admins where rank = 'supermoderator' or rank = 'god'"
          )
          .forEach((element) => {
            mainBot.sendMessage(
              element.chat_id,
              'New admin <a href="tg://user?id=' +
                msg.chat.id +
                '">' +
                msg.from.first_name +
                "</a>",
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
        mainBot.sendMessage(
          msg.chat.id,
          "Чат додано як адміністратор. Для відміни введіть команду /admin delete",
          { parse_mode: "HTML" }
        );
      } else {
        mainBot.sendMessage(
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
      mainBot.sendMessage(
        msg.chat.id,
        "Чат видалено зі списку адміністраторів.",
        { parse_mode: "HTML" }
      );
    } else {
      mainBot.sendMessage(msg.chat.id, "Невірний пароль");
    }
  },
};

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
