import type { JoinEdge, SchemaColumnDoc } from "./schema_store";
import { loadJoinGraph } from "./schema_store";
import fs from "node:fs";
import path from "node:path";

type TableSelection = {
  mappedTable: string;
  score: number;
  strongCount: number;
};

type EnumInfo = {
  name: string;
  values: string[];
  usedInTables: Array<{
    table: string;
    mappedTable: string;
    field: string;
    mappedColumn: string;
  }>;
};

let enumCache: EnumInfo[] | null = null;

function uniq<T>(arr: T[]) {
  return Array.from(new Set(arr));
}

export function selectTablesFromColumnMatches(
  docs: SchemaColumnDoc[],
  opts?: { maxTables?: number; strongRatio?: number; veryStrongRatio?: number },
): string[] {
  const maxTables = opts?.maxTables ?? 6;
  const strongRatio = opts?.strongRatio ?? 0.85;
  const veryStrongRatio = opts?.veryStrongRatio ?? 0.92;

  const scored = docs.filter((d) => typeof d.score === "number" && d.metadata?.mapped_table);
  if (scored.length === 0) return [];

  const best = Math.max(...scored.map((d) => d.score || 0));
  const strongCut = best * strongRatio;
  const veryStrongCut = best * veryStrongRatio;

  const byTable: Record<string, number[]> = {};
  const strongCountByTable: Record<string, number> = {};
  const veryStrongByTable: Record<string, boolean> = {};

  for (const d of scored) {
    const t = d.metadata.mapped_table;
    if (!byTable[t]) byTable[t] = [];
    byTable[t].push(d.score || 0);
    if ((d.score || 0) >= strongCut) strongCountByTable[t] = (strongCountByTable[t] || 0) + 1;
    if ((d.score || 0) >= veryStrongCut) veryStrongByTable[t] = true;
  }

  const selections: TableSelection[] = Object.keys(byTable).map((t) => {
    const scores = byTable[t].sort((a, b) => b - a);
    const topSum = scores.slice(0, 5).reduce((acc, s) => acc + s, 0);
    const strongCount = strongCountByTable[t] || 0;
    const bonus = veryStrongByTable[t] ? 1 : 0;
    return { mappedTable: t, score: topSum + strongCount * 0.1 + bonus * 0.2, strongCount };
  });

  const kept = selections
    .filter((s) => s.strongCount >= 2 || (veryStrongByTable[s.mappedTable] && s.strongCount >= 1))
    .sort((a, b) => b.score - a.score)
    .slice(0, maxTables)
    .map((s) => s.mappedTable);

  return kept;
}

export function selectColumnsForTables(
  docs: SchemaColumnDoc[],
  mappedTables: string[],
  opts?: { maxColumnsPerTable?: number },
): Record<string, string[]> {
  const maxColumnsPerTable = opts?.maxColumnsPerTable ?? 12;
  const set = new Set(mappedTables);

  const byTable: Record<string, SchemaColumnDoc[]> = {};
  for (const d of docs) {
    const t = d.metadata?.mapped_table;
    if (!t || !set.has(t)) continue;
    if (!byTable[t]) byTable[t] = [];
    byTable[t].push(d);
  }

  const result: Record<string, string[]> = {};
  for (const t of mappedTables) {
    const list = (byTable[t] || []).sort((a, b) => (b.score || 0) - (a.score || 0));
    const pkfk = list.filter((d) => d.metadata?.is_pk || d.metadata?.is_fk).map((d) => d.metadata.mapped_column);
    const top = list.map((d) => d.metadata.mapped_column);
    const cols = uniq([...pkfk, ...top]).slice(0, maxColumnsPerTable);
    result[t] = cols;
  }
  return result;
}

function buildGraph(edges: JoinEdge[]) {
  const adj: Record<string, Array<{ to: string; edge: JoinEdge }>> = {};
  for (const e of edges) {
    const a = e.from_mapped_table;
    const b = e.to_mapped_table;
    if (!adj[a]) adj[a] = [];
    if (!adj[b]) adj[b] = [];
    adj[a].push({ to: b, edge: e });
    // undirected for connectivity (we can still print directional join)
    adj[b].push({
      to: a,
      edge: {
        from_table: e.to_table,
        from_mapped_table: e.to_mapped_table,
        from_column: e.to_column,
        from_mapped_column: e.to_mapped_column,
        to_table: e.from_table,
        to_mapped_table: e.from_mapped_table,
        to_column: e.from_column,
        to_mapped_column: e.from_mapped_column,
      },
    });
  }
  return adj;
}

function shortestPathEdges(adj: Record<string, Array<{ to: string; edge: JoinEdge }>>, start: string, goal: string) {
  const queue: string[] = [start];
  const prev: Record<string, { node: string; edge: JoinEdge } | null> = { [start]: null };

  while (queue.length) {
    const n = queue.shift()!;
    if (n === goal) break;
    for (const { to, edge } of adj[n] || []) {
      if (prev[to] !== undefined) continue;
      prev[to] = { node: n, edge };
      queue.push(to);
    }
  }

  if (prev[goal] === undefined) return null;

  const edges: JoinEdge[] = [];
  let cur = goal;
  while (cur !== start) {
    const p = prev[cur];
    if (!p) break;
    edges.push(p.edge);
    cur = p.node;
  }
  edges.reverse();
  return edges;
}

export function selectJoinEdgesForTables(mappedTables: string[]) {
  const allEdges = loadJoinGraph();
  const set = new Set(mappedTables);
  const relevant = allEdges.filter((e) => set.has(e.from_mapped_table) && set.has(e.to_mapped_table));
  if (mappedTables.length <= 1) return [];

  const adj = buildGraph(relevant);
  const base = mappedTables[0];
  const chosen: JoinEdge[] = [];
  const chosenKey = new Set<string>();

  function addEdge(e: JoinEdge) {
    const key = `${e.from_mapped_table}.${e.from_mapped_column}=${e.to_mapped_table}.${e.to_mapped_column}`;
    if (chosenKey.has(key)) return;
    chosenKey.add(key);
    chosen.push(e);
  }

  for (const t of mappedTables.slice(1)) {
    const path = shortestPathEdges(adj, base, t);
    if (!path) continue;
    for (const e of path) addEdge(e);
  }

  return chosen;
}

function loadEnums(): EnumInfo[] {
  if (enumCache) return enumCache;
  
  try {
    const enumPath = path.join(process.cwd(), "data", "schema_enums.json");
    if (fs.existsSync(enumPath)) {
      const enumJson = fs.readFileSync(enumPath, "utf8");
      const parsed = JSON.parse(enumJson);
      enumCache = (parsed.enums || []) as EnumInfo[];
      return enumCache;
    }
  } catch (err) {
    console.warn("[Schema Compiler] Failed to load enum data:", err);
  }
  
  enumCache = [];
  return enumCache;
}

export function selectEnumsForTables(mappedTables: string[]): EnumInfo[] {
  const allEnums = loadEnums();
  if (allEnums.length === 0) return [];
  
  const tableSet = new Set(mappedTables);
  const relevantEnums: EnumInfo[] = [];
  
  for (const enumInfo of allEnums) {
    const usedInSelectedTables = enumInfo.usedInTables.filter((u) => tableSet.has(u.mappedTable));
    if (usedInSelectedTables.length > 0) {
      relevantEnums.push({
        ...enumInfo,
        usedInTables: usedInSelectedTables,
      });
    }
  }
  
  return relevantEnums;
}

export function compileSchemaBlock(
  mappedTables: string[],
  tableColumns: Record<string, string[]>,
  joinEdges: JoinEdge[],
  enums?: EnumInfo[],
) {
  const tablesLines = mappedTables.map((t) => {
    const cols = tableColumns[t] || [];
    return `- "${t}": ${cols.join(", ")}`;
  });

  const joinLines = joinEdges.map(
    (e) =>
      `- "${e.from_mapped_table}"."${e.from_mapped_column}" = "${e.to_mapped_table}"."${e.to_mapped_column}"`,
  );

  // Filter enums to only those used in the selected tables
  const relevantEnums: EnumInfo[] = [];
  if (enums) {
    const tableSet = new Set(mappedTables);
    for (const enumInfo of enums) {
      const usedInSelectedTables = enumInfo.usedInTables.filter((u) => tableSet.has(u.mappedTable));
      if (usedInSelectedTables.length > 0) {
        relevantEnums.push({
          ...enumInfo,
          usedInTables: usedInSelectedTables,
        });
      }
    }
  }

  const enumLines: string[] = [];
  if (relevantEnums.length > 0) {
    for (const enumInfo of relevantEnums) {
      const tableFields = enumInfo.usedInTables
        .map((u) => `"${u.mappedTable}"."${u.mappedColumn}"`)
        .join(", ");
      enumLines.push(
        `- ${enumInfo.name}: [${enumInfo.values.map((v) => `'${v}'`).join(", ")}] (used in ${tableFields})`,
      );
    }
  }

  return [
    `SCHEMA (Postgres). Use ONLY these identifiers.`,
    ``,
    `Tables:`,
    ...tablesLines,
    ``,
    `Joins:`,
    ...(joinLines.length ? joinLines : [`- (no joins needed)`]),
    ...(enumLines.length > 0
      ? [
          ``,
          `Enums (valid values for enum columns):`,
          ...enumLines,
        ]
      : []),
  ].join("\n");
}

