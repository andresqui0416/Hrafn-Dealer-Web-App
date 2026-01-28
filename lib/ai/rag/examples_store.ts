import { PrismaClient } from "@prisma/client";
import { getPineconeIndex, pineconeEnabled } from "./pinecone";
import { embedText } from "./embeddings";

export type NLQExample = { question: string; sql: string };

export function fineTuningNamespace() {
  // NLQ examples live in their own namespace
  return process.env.PINECONE_NAMESPACE_NLP || "fine_tuning_nlq";
}

export async function retrieveNLQExamples(
  prisma: PrismaClient,
  question: string,
  topK = 3,
): Promise<NLQExample[]> {
  if (!pineconeEnabled()) return [];

  const index = getPineconeIndex().namespace(fineTuningNamespace());
  const vector = await embedText(question);

  const res = await index.query({
    vector,
    topK: Math.min(10, Math.max(1, topK)),
    includeMetadata: true,
    filter: { type: "NLQ" } as any,
  });

  const ids = (res.matches || []).map((m) => String(m.id)).filter(Boolean);
  if (ids.length === 0) return [];

  const samples = await prisma.fineTuningSample.findMany({
    where: { id: { in: ids }, type: "NLQ" },
    select: { id: true, question: true, answer: true },
  });

  // Preserve Pinecone ordering
  const byId = new Map(samples.map((s) => [s.id, s]));
  const ordered = ids.map((id) => byId.get(id)).filter(Boolean) as typeof samples;

  return ordered.slice(0, topK).map((s) => ({ question: s.question, sql: s.answer }));
}
