const data = require("sqlite-sync");
data.connect("database/careers_ef.db");
module.exports = {
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
};
