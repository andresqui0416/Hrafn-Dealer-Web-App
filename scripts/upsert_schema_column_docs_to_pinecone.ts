import fs from "node:fs";
import path from "node:path";
import OpenAI from "openai";
import { Pinecone } from "@pinecone-database/pinecone";
import dotenv from "dotenv";

function loadEnvFiles() {
  const cwd = process.cwd();
  const envPath = path.join(cwd, ".env");
  const envLocalPath = path.join(cwd, ".env.local");
  if (fs.existsSync(envPath)) dotenv.config({ path: envPath });
  if (fs.existsSync(envLocalPath)) dotenv.config({ path: envLocalPath, override: true });
}

type ColumnDoc = {
  id: string;
  text: string;
  metadata: Record<string, any>;
};

function requireEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set`);
  return v;
}

function chunk<T>(arr: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function truncate(s: string, maxLen: number) {
  if (s.length <= maxLen) return s;
  return s.slice(0, maxLen);
}

async function main() {
  loadEnvFiles();

  const repoRoot = path.resolve(__dirname, "..");
  const inputPath = path.join(repoRoot, "data", "schema_column_docs.json");

  const OPENAI_API_KEY = requireEnv("OPENAI_API_KEY");
  const PINECONE_API_KEY = requireEnv("PINECONE_API_KEY");
  const PINECONE_INDEX = requireEnv("PINECONE_INDEX");
  const PINECONE_NAMESPACE = process.env.PINECONE_NAMESPACE_SCHEMA_COLUMNS || "schema_columns";
  const OPENAI_EMBEDDING_MODEL = process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small";
  const OPENAI_EMBEDDING_DIMENSIONS = process.env.OPENAI_EMBEDDING_DIMENSIONS
    ? Number(process.env.OPENAI_EMBEDDING_DIMENSIONS)
    : undefined;

  if (!fs.existsSync(inputPath)) {
    throw new Error(`Missing file: ${inputPath}`);
  }

  const raw = fs.readFileSync(inputPath, "utf8");
  const docs = JSON.parse(raw) as ColumnDoc[];
  if (!Array.isArray(docs) || docs.length === 0) {
    throw new Error("schema_column_docs.json is empty or invalid");
  }

  // Basic validation
  for (const d of docs) {
    if (!d?.id || !d?.text || !d?.metadata) {
      throw new Error("Each doc must have id, text, metadata");
    }
  }

  const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
  const pinecone = new Pinecone({ apiKey: PINECONE_API_KEY });
  const index = pinecone.index(PINECONE_INDEX).namespace(PINECONE_NAMESPACE);

  // Check if namespace has vectors, then delete if it does
  // eslint-disable-next-line no-console
  console.log(
    `Checking Pinecone index "${PINECONE_INDEX}" namespace "${PINECONE_NAMESPACE}" for existing vectors...`,
  );
  try {
    // Try a small query to see if namespace has any vectors
    const checkQuery = await index.query({
      vector: new Array(OPENAI_EMBEDDING_DIMENSIONS || 1536).fill(0),
      topK: 1,
      includeMetadata: false,
    });

    const hasVectors = checkQuery.matches && checkQuery.matches.length > 0;

    if (hasVectors) {
      // eslint-disable-next-line no-console
      console.log(`Found existing vectors. Clearing namespace before upsert...`);
      // Delete existing vectors in this namespace before re-uploading
      // Pinecone SDK versions differ slightly, so we keep a small compatibility fallback.
      if (typeof (index as any).deleteAll === "function") {
        await (index as any).deleteAll();
      } else if (typeof (index as any).delete === "function") {
        await (index as any).delete({ deleteAll: true });
      } else {
        throw new Error("Pinecone index client does not support deleteAll/delete");
      }
    } else {
      // eslint-disable-next-line no-console
      console.log(`Namespace is empty. Skipping delete step.`);
    }
  } catch (error: any) {
    // If query fails (e.g., namespace doesn't exist or is empty), skip delete
    if (error?.status === 404 || error?.message?.includes("404")) {
      // eslint-disable-next-line no-console
      console.log(`Namespace appears empty or doesn't exist. Skipping delete step.`);
    } else {
      // For other errors, log but continue (might be empty namespace)
      // eslint-disable-next-line no-console
      console.warn(`Could not check namespace status: ${error?.message || error}. Continuing...`);
    }
  }

  // Embed + upsert in batches
  const embedBatchSize = 96; // safe for OpenAI embeddings
  const upsertBatchSize = 100;

  let upserted = 0;

  const embedBatches = chunk(docs, embedBatchSize);
  for (let b = 0; b < embedBatches.length; b++) {
    const batchDocs = embedBatches[b];
    const texts = batchDocs.map((d) => d.text);

    const embResp = await openai.embeddings.create({
      model: OPENAI_EMBEDDING_MODEL,
      input: texts,
      ...(OPENAI_EMBEDDING_DIMENSIONS ? { dimensions: OPENAI_EMBEDDING_DIMENSIONS } : {}),
    });

    const vectors = batchDocs.map((d, i) => ({
      id: d.id,
      values: embResp.data[i].embedding,
      metadata: {
        ...d.metadata,
        // optional: include a copy of the text for debugging (keep bounded)
        text: truncate(d.text, 5000),
      },
    }));

    for (const upsertChunk of chunk(vectors, upsertBatchSize)) {
      await index.upsert(upsertChunk);
      upserted += upsertChunk.length;
    }

    // eslint-disable-next-line no-console
    console.log(`Upserted ${upserted}/${docs.length} docs...`);
  }

  // eslint-disable-next-line no-console
  console.log(
    `Done. Upserted ${upserted} schema column docs to Pinecone index "${PINECONE_INDEX}" namespace "${PINECONE_NAMESPACE}".`,
  );
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
