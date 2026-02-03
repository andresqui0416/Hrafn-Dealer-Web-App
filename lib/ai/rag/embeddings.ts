import { openai } from "@/lib/ai";

export function getEmbeddingModel() {
  return process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small";
}

export function getEmbeddingDimensions(): number | undefined {
  const raw = process.env.OPENAI_EMBEDDING_DIMENSIONS;
  if (!raw) return undefined;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return Math.floor(n);
}

export async function embedText(text: string): Promise<number[]> {
  const resp = await openai.embeddings.create({
    model: getEmbeddingModel(),
    input: text,
    ...(getEmbeddingDimensions() ? { dimensions: getEmbeddingDimensions() } : {}),
  });
  const emb = resp.data?.[0]?.embedding;
  if (!emb) throw new Error("No embedding returned");
  return emb;
}
