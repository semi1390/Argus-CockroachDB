import "dotenv/config";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "../src/db/index.js";

const migrationsDir = path.dirname(fileURLToPath(import.meta.url));

async function runMigrations() {
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  if (files.length === 0) {
    console.log("[migrate] No .sql files found in", migrationsDir);
    return;
  }

  for (const file of files) {
    const filePath = path.join(migrationsDir, file);
    const sql = readFileSync(filePath, "utf-8");
    console.log(`[migrate] Running ${file}...`);
    try {
      await pool.query(sql);
      console.log(`[migrate] ${file} applied successfully.`);
    } catch (err) {
      console.error(`[migrate] ${file} FAILED:`, err);
      throw err;
    }
  }
}

runMigrations()
  .then(() => {
    console.log("[migrate] All migrations applied.");
    return pool.end();
  })
  .catch((err) => {
    console.error("[migrate] Migration run failed:", err);
    return pool.end().finally(() => process.exit(1));
  });
