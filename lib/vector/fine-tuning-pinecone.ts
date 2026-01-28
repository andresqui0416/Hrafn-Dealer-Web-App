import { Pinecone } from "@pinecone-database/pinecone";
import { openai } from "@/lib/ai";
import { getEmbeddingDimensions } from "@/lib/ai/rag/embeddings";

export type FineTuningVectorType = "NLQ" | "FAQ";

export type FineTuningVectorSample = {
  id: string;
  type: FineTuningVectorType;
  question: string;
  answer: string;
  createdAt?: string | Date;
};

export function fineTuningPineconeEnabled() {
  return Boolean(process.env.PINECONE_API_KEY && process.env.PINECONE_INDEX);
}

function getPineconeBaseIndex() {
  if (!process.env.PINECONE_API_KEY) {
    throw new Error("PINECONE_API_KEY is not set");
  }
  if (!process.env.PINECONE_INDEX) {
    throw new Error("PINECONE_INDEX is not set");
  }

  const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
  return pinecone.index(process.env.PINECONE_INDEX);
}

function namespaceForType(type: FineTuningVectorType) {
  // User wants separate namespaces per stage/type
  if (type === "NLQ") {
    return process.env.PINECONE_NAMESPACE_NLP || "fine_tuning_nlq";
  }
  return process.env.PINECONE_NAMESPACE_FAQ || "fine_tuning_faq";
}

function getEmbeddingModel() {
  return process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small";
}

function truncateForMetadata(s: string, maxLen: number) {
  if (s.length <= maxLen) return s;
  return s.slice(0, maxLen);
}

async function embedQuestions(questions: string[]) {
  const model = getEmbeddingModel();
  const dimensions = getEmbeddingDimensions();
  const resp = await openai.embeddings.create({
    model,
    input: questions,
    ...(dimensions ? { dimensions } : {}),
  });
  return resp.data.map((d) => d.embedding);
}

export async function upsertFineTuningSamplesToPinecone(samples: FineTuningVectorSample[]) {
  if (!fineTuningPineconeEnabled()) {
    return { enabled: false, upserted: 0 };
  }
  if (samples.length === 0) {
    return { enabled: true, upserted: 0 };
  }

  const baseIndex = getPineconeBaseIndex();

  // Group by type → namespace
  const groups: Record<FineTuningVectorType, FineTuningVectorSample[]> = {
    NLQ: [],
    FAQ: [],
  };
  for (const s of samples) groups[s.type].push(s);

  let upserted = 0;

  for (const type of ["NLQ", "FAQ"] as const) {
    const group = groups[type];
    if (!group.length) continue;

    const index = baseIndex.namespace(namespaceForType(type));

    // We embed the QUESTION (primary retrieval key). Answer stays in metadata.
    const embeddings = await embedQuestions(group.map((s) => s.question));

    const vectors = group.map((s, i) => {
      const createdAt =
        s.createdAt instanceof Date
          ? s.createdAt.toISOString()
          : typeof s.createdAt === "string"
            ? s.createdAt
            : undefined;

      return {
        id: s.id,
        values: embeddings[i],
        metadata: {
          source: "fine_tuning_sample",
          type: s.type,
          question: truncateForMetadata(s.question, 5000),
          // Answers can be long (SQL), keep a preview in metadata to avoid size issues.
          answer_preview: truncateForMetadata(s.answer, 5000),
          ...(createdAt ? { created_at: createdAt } : {}),
        },
      };
    });

    // Pinecone upsert supports batching; keep chunks reasonable.
    const batchSize = 100;
    for (let i = 0; i < vectors.length; i += batchSize) {
      const chunk = vectors.slice(i, i + batchSize);
      await index.upsert(chunk);
      upserted += chunk.length;
    }
  }

  return { enabled: true, upserted };
}

export async function deleteFineTuningSamplesFromPinecone(
  items: Array<{ id: string; type: FineTuningVectorType }>,
) {
  if (!fineTuningPineconeEnabled()) {
    return { enabled: false, deleted: 0 };
  }
  if (items.length === 0) {
    return { enabled: true, deleted: 0 };
  }

  const baseIndex = getPineconeBaseIndex();

  const byNs = new Map<string, string[]>();
  for (const it of items) {
    const ns = namespaceForType(it.type);
    const arr = byNs.get(ns) || [];
    arr.push(it.id);
    byNs.set(ns, arr);
  }

  let deleted = 0;
  for (const [ns, ids] of byNs.entries()) {
    const index = baseIndex.namespace(ns);
    const batchSize = 1000;
    for (let i = 0; i < ids.length; i += batchSize) {
      await index.deleteMany(ids.slice(i, i + batchSize));
      deleted += Math.min(batchSize, ids.length - i);
    }
  }

  return { enabled: true, deleted };
}
