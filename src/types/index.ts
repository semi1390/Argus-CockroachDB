export interface ThreatRecord {
  id: string;
  walletAddress: string;
  status: string;
  confidence: number;
  summary: string;
  embedding: number[];
  createdAt: string;
  updatedAt: string;
}

export type Embedding = number[];
