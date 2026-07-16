-- ARGUS pipeline spike: threat_records table with a distributed vector index.
-- Vector indexes are a preview feature in CockroachDB v25.2+; this cluster
-- setting must be enabled before CREATE TABLE/CREATE INDEX with VECTOR INDEX
-- will succeed. As of v25.2, vector indexes only support L2 (Euclidean)
-- distance (vector_l2_ops) -- cosine/inner product are on the roadmap.
SET CLUSTER SETTING feature.vector_index.enabled = true;

CREATE TABLE IF NOT EXISTS threat_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT NOT NULL,
  status TEXT NOT NULL,
  confidence FLOAT NOT NULL,
  summary TEXT NOT NULL,
  embedding VECTOR(1024) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  VECTOR INDEX threat_records_embedding_idx (embedding vector_l2_ops)
);
