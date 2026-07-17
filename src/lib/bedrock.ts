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

// maxAttempts is a backstop for transient errors in general; the explicit
// retry loop below in embed() owns the long-tail backoff for throttling
// specifically, since a fresh AWS account's low initial Bedrock quota can
// throttle well past what the SDK's own retry strategy will wait out.
const client = new BedrockRuntimeClient({ region, maxAttempts: 5 });

interface TitanEmbeddingResponse {
  embedding: number[];
  inputTextTokenCount: number;
}

const MAX_THROTTLE_RETRIES = 6;
const BASE_DELAY_MS = 1000;
const MAX_JITTER_MS = 250;

function isThrottlingError(err: unknown): boolean {
  const name = (err as { name?: string })?.name;
  const statusCode = (err as { $metadata?: { httpStatusCode?: number } })?.$metadata?.httpStatusCode;
  return name === "ThrottlingException" || statusCode === 429;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function invokeWithThrottleRetry(command: InvokeModelCommand) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await client.send(command);
    } catch (err) {
      if (!isThrottlingError(err) || attempt >= MAX_THROTTLE_RETRIES) {
        throw err;
      }
      const delay = BASE_DELAY_MS * 2 ** attempt + Math.random() * MAX_JITTER_MS;
      console.warn(
        `[bedrock] Throttled (attempt ${attempt + 1}/${MAX_THROTTLE_RETRIES}), retrying in ${Math.round(delay)}ms...`,
      );
      await sleep(delay);
    }
  }
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

  const response = await invokeWithThrottleRetry(command);
  const payload = JSON.parse(Buffer.from(response.body).toString("utf-8")) as TitanEmbeddingResponse;

  if (!Array.isArray(payload.embedding) || payload.embedding.length !== 1024) {
    throw new Error(
      `Unexpected embedding response shape (length ${payload.embedding?.length ?? "unknown"})`,
    );
  }

  return payload.embedding;
}
