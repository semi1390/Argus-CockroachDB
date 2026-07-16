import "dotenv/config";
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";
import type { Embedding } from "../types/index.js";

const region = process.env.AWS_REGION;
const modelId = process.env.BEDROCK_EMBEDDING_MODEL_ID ?? "amazon.titan-embed-text-v2:0";

if (!region) {
  throw new Error("AWS_REGION is not set. Copy .env.example to .env and fill it in.");
}

const client = new BedrockRuntimeClient({ region });

interface TitanEmbeddingResponse {
  embedding: number[];
  inputTextTokenCount: number;
}

export async function embed(text: string): Promise<Embedding> {
  const command = new InvokeModelCommand({
    modelId,
    contentType: "application/json",
    accept: "application/json",
    body: JSON.stringify({
      inputText: text,
      dimensions: 1024,
      normalize: true,
    }),
  });

  const response = await client.send(command);
  const payload = JSON.parse(Buffer.from(response.body).toString("utf-8")) as TitanEmbeddingResponse;

  if (!Array.isArray(payload.embedding) || payload.embedding.length !== 1024) {
    throw new Error(
      `Unexpected embedding response shape (length ${payload.embedding?.length ?? "unknown"})`,
    );
  }

  return payload.embedding;
}
