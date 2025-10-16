import sqlite3 from "sqlite3";
import { open } from "sqlite";

// open DB connection
export const dbPromise = open({
  filename: "./sales.db",
  driver: sqlite3.Database,
});

// create sales table if not exists
(async () => {
  const db = await dbPromise;
  await db.exec(`
    CREATE TABLE IF NOT EXISTS sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      address TEXT,
      phone TEXT,
      quantity INTEGER,
      amount INTEGER,
      stripe_id TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log("✅ Database initialized");
})();
