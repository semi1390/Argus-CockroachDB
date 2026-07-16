import "dotenv/config";
import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set. Copy .env.example to .env and fill it in.");
}

export const pool = new Pool({
  connectionString,
  ssl: connectionString.includes("sslmode=disable") ? false : { rejectUnauthorized: true },
});

export async function testConnection(): Promise<boolean> {
  try {
    const result = await pool.query("SELECT 1 AS ok");
    console.log("[db] Connection OK:", result.rows[0]);
    return true;
  } catch (err) {
    console.error("[db] Connection FAILED:", err);
    return false;
  }
}
