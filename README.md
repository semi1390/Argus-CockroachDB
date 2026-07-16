# ARGUS — Data Pipeline Spike

This is a minimal, end-to-end plumbing test for the ARGUS pipeline: **CockroachDB write → Bedrock embed → vector similarity search**. No agents, no product logic — just proof that the pieces connect.

## Folder structure

```
src/
  db/       CockroachDB connection (pg Pool + testConnection())
  lib/      Bedrock embed() helper
  agents/   empty — reserved for future agent code
  types/    shared TS types
  spike.ts  the end-to-end pipeline script
migrations/
  001_create_threat_records.sql  schema for threat_records
  run-migrations.ts              runs all .sql files in this folder
```

## Prerequisites

- Node.js 20+
- [pnpm](https://pnpm.io/) (`npm install -g pnpm` if you don't have it)

## 1. Install dependencies

```bash
pnpm install
```

## 2. Get a CockroachDB connection string

1. Sign up / log in at [CockroachDB Cloud](https://cockroachlabs.cloud/) (a free Serverless cluster is enough for this spike).
2. Create a cluster (or use an existing one).
3. In the console: **Cluster → Connect**, choose a SQL user (create one if needed), and select the **General connection string** option.
4. Copy the full connection string — it looks like:
   ```
   postgresql://<user>:<password>@<host>:26257/<database>?sslmode=verify-full
   ```
5. Vector indexes are a **preview feature** (CockroachDB v25.2+). The migration in this repo enables it automatically with `SET CLUSTER SETTING feature.vector_index.enabled = true;`, but your SQL user needs privileges to set cluster settings — the default `admin` role covers this. If you're on a shared/managed cluster where you can't set cluster settings, ask whoever administers it to run that statement once, or run it yourself via the CockroachDB Cloud SQL shell.

## 3. Get AWS Bedrock credentials

1. In the AWS Console, go to **Bedrock → Model access** in your target region (e.g. `us-east-1`) and request/enable access to **Amazon Titan Text Embeddings V2** (`amazon.titan-embed-text-v2:0`). Approval is usually instant.
2. Create an IAM user (or use an existing role) with a policy that allows `bedrock:InvokeModel` on that model, e.g.:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [{
       "Effect": "Allow",
       "Action": "bedrock:InvokeModel",
       "Resource": "arn:aws:bedrock:*::foundation-model/amazon.titan-embed-text-v2:0"
     }]
   }
   ```
3. Generate an access key for that IAM user (**IAM → Users → Security credentials → Create access key**).

## 4. Configure environment variables

Copy the example file and fill in your values:

```bash
cp .env.example .env
```

| Variable | Description |
|---|---|
| `DATABASE_URL` | Full CockroachDB connection string from step 2 |
| `AWS_REGION` | AWS region where you enabled Titan Embeddings, e.g. `us-east-1` |
| `AWS_ACCESS_KEY_ID` | IAM access key ID |
| `AWS_SECRET_ACCESS_KEY` | IAM secret access key |
| `AWS_SESSION_TOKEN` | Only needed if using temporary/STS credentials |
| `BEDROCK_EMBEDDING_MODEL_ID` | Defaults to `amazon.titan-embed-text-v2:0` — override if needed |

## 5. Run the migration

```bash
pnpm migrate
```

This creates the `threat_records` table (with a `VECTOR(1024)` column and a distributed vector index on it) if it doesn't already exist.

## 6. Run the spike

```bash
pnpm spike
```

This will:
1. Connect to CockroachDB and run `SELECT 1` to confirm connectivity.
2. Call Bedrock (Titan Text Embeddings V2) to embed the string `"test malicious wallet"` into a 1024-dim vector.
3. Insert one row into `threat_records` with that embedding.
4. Run a vector similarity search (`ORDER BY embedding <-> $1 LIMIT 3`) and print the nearest neighbors.
5. Confirm the inserted row is retrieved back as the top (distance ≈ 0) match.

If you see `[spike] SUCCESS: retrieved the inserted record via vector search.` at the end, the full pipeline — write, embed, and vector search — is working.

## Notes

- CockroachDB's vector index currently supports L2 (Euclidean) distance only (`vector_l2_ops`); cosine and inner product are on the roadmap. The spike and migration use the `<->` (L2) operator accordingly.
- This is intentionally minimal — no retries, no batching, no agent logic. It exists to de-risk the plumbing before building on top of it.
