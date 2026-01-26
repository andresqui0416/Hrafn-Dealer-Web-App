import fs from "node:fs";
import path from "node:path";
import { embedText } from "./embeddings";
import { getPineconeIndex, pineconeEnabled } from "./pinecone";

export type SchemaColumnDoc = {
  id: string;
  text: string;
  metadata: {
    kind: "column";
    table: string; // Prisma model
    mapped_table: string; // Postgres table
    column: string; // Prisma field
    mapped_column: string; // Postgres column
    type: string;
    importance?: "high" | "medium" | "low";
    synonyms?: string[];
    domain?: string;
    is_pk?: boolean;
    is_fk?: boolean;
    fk_target?: string;
    [k: string]: any;
  };
  score?: number;
};

export type SchemaTableDoc = {
  id: string;
  text: string;
  metadata: {
    kind: "table";
    table: string; // Prisma model
    mapped_table: string; // Postgres table
    domain?: string;
    synonyms?: string[];
    [k: string]: any;
  };
  score?: number;
};

export type JoinEdge = {
  from_table: string;
  from_mapped_table: string;
  from_column: string;
  from_mapped_column: string;
  to_table: string;
  to_mapped_table: string;
  to_column: string;
  to_mapped_column: string;
};

let joinGraphCache: JoinEdge[] | null = null;

export function loadJoinGraph(): JoinEdge[] {
  if (joinGraphCache) return joinGraphCache;
  const filePath = path.join(process.cwd(), "data", "schema_join_graph.json");
  const raw = fs.readFileSync(filePath, "utf8");
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) throw new Error("schema_join_graph.json is invalid");
  joinGraphCache = parsed as JoinEdge[];
  return joinGraphCache;
}

export function schemaPineconeNamespace() {
  // Use PINECONE_NAMESPACE_SCHEMA_COLUMNS to match the upsert script
  return process.env.PINECONE_NAMESPACE_SCHEMA_COLUMNS || "schema_columns";
}

export function schemaTablesPineconeNamespace() {
  return process.env.PINECONE_NAMESPACE_SCHEMA_TABLES || "schema_tables";
}

export async function retrieveSchemaColumnDocs(
  question: string,
  topK = 50,
): Promise<SchemaColumnDoc[]> {
  if (!pineconeEnabled()) {
    throw new Error("Pinecone is not configured (PINECONE_API_KEY/PINECONE_INDEX missing)");
  }
  const index = getPineconeIndex().namespace(schemaPineconeNamespace());
  const vector = await embedText(question);

  const res = await index.query({
    vector,
    topK,
    includeMetadata: true,
  });

  const matches = res.matches || [];
  return matches
    .filter((m) => m.id && m.metadata && typeof m.score === "number")
    .map((m) => ({
      id: String(m.id),
      text: typeof (m.metadata as any).text === "string" ? (m.metadata as any).text : "",
      metadata: m.metadata as any,
      score: m.score,
    }))
    .filter((d) => d.metadata?.kind === "column");
}

export async function retrieveSchemaTableDocs(
  question: string,
  topK = 8,
): Promise<SchemaTableDoc[]> {
  if (!pineconeEnabled()) {
    throw new Error("Pinecone is not configured (PINECONE_API_KEY/PINECONE_INDEX missing)");
  }
  const index = getPineconeIndex().namespace(schemaTablesPineconeNamespace());
  const vector = await embedText(question);

  const res = await index.query({
    vector,
    topK: Math.min(20, Math.max(1, topK)),
    includeMetadata: true,
  });

  const matches = res.matches || [];
  return matches
    .filter((m) => m.id && m.metadata && typeof m.score === "number")
    .map((m) => ({
      id: String(m.id),
      text: typeof (m.metadata as any).text === "string" ? (m.metadata as any).text : "",
      metadata: m.metadata as any,
      score: m.score,
    }))
    .filter((d) => d.metadata?.kind === "table");
}

export async function retrieveSchemaColumnDocsForTables(
  question: string,
  mappedTables: string[],
  topK = 80,
): Promise<SchemaColumnDoc[]> {
  if (!pineconeEnabled()) {
    throw new Error("Pinecone is not configured (PINECONE_API_KEY/PINECONE_INDEX missing)");
  }
  const tables = Array.from(new Set(mappedTables)).filter(Boolean);
  if (tables.length === 0) return [];

  const namespace = schemaPineconeNamespace();
  const index = getPineconeIndex().namespace(namespace);
  
  console.log(`[Schema RAG] Querying Pinecone namespace: "${namespace}" for ${tables.length} tables: ${tables.join(", ")}`);
  
  // Build a query that includes table names to improve matching
  // This helps the semantic search find columns from the specific tables
  const tableNamesText = tables.map(t => `table "${t}"`).join(", ");
  const enhancedQuery = `${question} columns for ${tableNamesText}`;
  
  const vector = await embedText(enhancedQuery);

  let res;
  try {
    res = await index.query({
      vector,
      topK: topK,
      includeMetadata: true,
      // Use Pinecone filter to get only columns from the requested tables
      filter: {
        kind: "column",
        mapped_table: { $in: tables },
      } as any,
    });
  } catch (err) {
    console.error(`[Schema RAG] Pinecone query failed:`, err);
    throw new Error(`Failed to query Pinecone for column docs: ${err instanceof Error ? err.message : String(err)}`);
  }

  const matches = res.matches || [];
  console.log(`[Schema RAG] Query returned ${matches.length} total matches`);
  
  // If we got 0 matches, it might mean the namespace is empty
  if (matches.length === 0) {
    console.warn(`[Schema RAG] WARNING: No matches found in namespace "${namespace}". ` +
      `This might mean column docs haven't been uploaded. ` +
      `Run: npm run upsert:schema-columns`);
  }
  
  const allColumnDocs = matches
    .filter((m) => m.id && m.metadata && typeof m.score === "number")
    .map((m) => ({
      id: String(m.id),
      text: typeof (m.metadata as any).text === "string" ? (m.metadata as any).text : "",
      metadata: m.metadata as any,
      score: m.score || 0,
    }));
  
  if (allColumnDocs.length === 0) {
    // If we still don't have enough results, try a fallback: query with just table names
    const fallbackQuery = `columns fields attributes for ${tableNamesText}`;
    const fallbackVector = await embedText(fallbackQuery);
    const fallbackRes = await index.query({
      vector: fallbackVector,
      topK: topK,
      includeMetadata: true,
      filter: {
        kind: "column",
        mapped_table: { $in: tables },
      } as any,
    });
    
    const fallbackMatches = fallbackRes.matches || [];
    const fallbackDocs = fallbackMatches
      .filter((m) => m.id && m.metadata && typeof m.score === "number")
      .map((m) => ({
        id: String(m.id),
        text: typeof (m.metadata as any).text === "string" ? (m.metadata as any).text : "",
        metadata: m.metadata as any,
        score: m.score || 0,
      }));
    
    allColumnDocs.push(...fallbackDocs);
  }
  
  if (allColumnDocs.length === 0) {
    return [];
  }
  
  // Group by table
  const groupedByTable: Record<string, SchemaColumnDoc[]> = {};
  for (const doc of allColumnDocs) {
    const table = doc.metadata?.mapped_table;
    if (table) {
      if (!groupedByTable[table]) {
        groupedByTable[table] = [];
      }
      groupedByTable[table].push(doc);
    }
  }
  
  // Ensure we have columns for each requested table (even if below threshold, take top ones)
  for (const table of tables) {
    if (!groupedByTable[table] || groupedByTable[table].length === 0) {
      // Get top columns for this table from allColumnDocs (even if below threshold)
      const tableColumns = allColumnDocs
        .filter(d => d.metadata?.mapped_table === table)
        .sort((a, b) => b.score - a.score)
        .slice(0, 10); // Take top 10 for tables with no high-scoring columns
      
      if (tableColumns.length > 0) {
        groupedByTable[table] = tableColumns;
      }
    }
  }
  
  // Flatten (Pinecone already returns sorted by score, so no need to sort again)
  const result = Object.values(groupedByTable).flat();
  
  return result;
}
