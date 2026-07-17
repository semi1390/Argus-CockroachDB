import "dotenv/config";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "../src/db/index.js";

const migrationsDir = path.dirname(fileURLToPath(import.meta.url));

// Sending a whole file as one multi-statement string makes pg use the
// simple query protocol, which CockroachDB executes as an implicit
// transaction -- and statements like SET CLUSTER SETTING are rejected
// inside any transaction. Splitting into single-statement queries avoids
// that wrapping entirely. Only safe because these migrations don't embed
// ";" inside string literals.
function splitStatements(sql: string): string[] {
  const withoutComments = sql
    .split("\n")
    .map((line) => {
      const commentIndex = line.indexOf("--");
      return commentIndex === -1 ? line : line.slice(0, commentIndex);
    })
    .join("\n");

  return withoutComments
    .split(";")
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0);
}

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
    const statements = splitStatements(sql);
    console.log(`[migrate] Running ${file} (${statements.length} statement(s))...`);
    try {
      for (const statement of statements) {
        await pool.query(statement);
      }
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
