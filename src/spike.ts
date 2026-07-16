import "dotenv/config";
import { pool, testConnection } from "./db/index.js";
import { embed } from "./lib/bedrock.js";

async function main() {
  console.log("[spike] Testing CockroachDB connection...");
  const connected = await testConnection();
  if (!connected) {
    throw new Error("Could not connect to CockroachDB. Check DATABASE_URL.");
  }

  const text = "test malicious wallet";
  console.log(`[spike] Embedding text: "${text}"`);
  const vector = await embed(text);
  console.log(`[spike] Got embedding with ${vector.length} dimensions.`);

  console.log("[spike] Inserting threat_record...");
  const embeddingLiteral = `[${vector.join(",")}]`;
  const insertResult = await pool.query(
    `INSERT INTO threat_records (wallet_address, status, confidence, summary, embedding)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, wallet_address, status, confidence, summary, created_at`,
    ["0xSPIKE_TEST_WALLET", "flagged", 0.99, text, embeddingLiteral],
  );
  const inserted = insertResult.rows[0];
  console.log("[spike] Inserted:", inserted);

  console.log("[spike] Running vector similarity search for nearest match...");
  const searchResult = await pool.query(
    `SELECT id, wallet_address, status, confidence, summary, created_at,
            embedding <-> $1 AS distance
     FROM threat_records
     ORDER BY embedding <-> $1
     LIMIT 3`,
    [embeddingLiteral],
  );

  console.log("[spike] Nearest neighbors:");
  for (const row of searchResult.rows) {
    console.log(
      `  id=${row.id} wallet=${row.wallet_address} status=${row.status} distance=${row.distance}`,
    );
  }

  const top = searchResult.rows[0];
  if (top?.id === inserted.id && Number(top.distance) < 1e-6) {
    console.log("[spike] SUCCESS: retrieved the inserted record via vector search.");
  } else {
    console.warn("[spike] WARNING: top match was not the inserted record as expected.");
  }
}

main()
  .catch((err) => {
    console.error("[spike] FAILED:", err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
