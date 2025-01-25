const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./demo.db');

function init() {
    db.serialize(() => {
        db.run("CREATE TABLE IF NOT EXISTS shares (id INTEGER PRIMARY KEY AUTOINCREMENT, timestamp INTEGER, valid BOOLEAN, user TEXT, jobId TEXT)");
    });
    console.log("Initialized SQLite database");
}


function insertShare(timestamp, valid, user, jobId) {
    db.run("INSERT INTO shares (timestamp, valid, user, jobId) VALUES (?, ?, ?, ?)", [timestamp, valid, user, jobId], (err) => {
        if (err) {
            return console.error(err.message);
        }
    });
}

async function getAllShares() {
    return new Promise((resolve, reject) => {
      db.all("SELECT * FROM shares", [], (err, rows) => {
        if (err) {
          reject(err);
           return reject(err);
        }
        resolve(rows);
      });
    });
  }

  module.exports = {
    init,
      insertShare,
    getAllShares
  };
