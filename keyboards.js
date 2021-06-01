module.exports = {
  start: {
    inline_keyboard: [
      [
        { text: "Відгук", callback_data: "feedback" },
        { text: "Запитання", callback_data: "question" },
      ],
      [{ text: "Запропонувати пост (для HR)", callback_data: "post" }],
    ],
  },
  cancel: {
    inline_keyboard: [[{ text: "Скасувати", callback_data: "cancel" }]],
  },
};
