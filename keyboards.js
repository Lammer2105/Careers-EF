module.exports = {
  feedback: {
    reply_markup: {
      inline_keyboard: [
        [
          { text: "Відгук", callback_data: "feedback" },
          { text: "Запитання", callback_data: "question" },
        ],
      ],
    },
    parse_mode: "HTML",
  },
};
