export function validateSelectOnly(sql: string): void {
  const trimmed = sql.trim();
  const upper = trimmed.toUpperCase();

  // allow WITH ... SELECT or SELECT
  if (!(upper.startsWith("SELECT") || upper.startsWith("WITH"))) {
    throw new Error("Only SELECT queries are allowed (CTEs via WITH are allowed)");
  }

  // Prevent multiple statements
  const semi = trimmed.indexOf(";");
  if (semi !== -1 && semi < trimmed.length - 1) {
    throw new Error("Multiple SQL statements are not allowed");
  }

  // Check for dangerous SQL keywords, but only as actual keywords (not inside identifiers/strings)
  // Remove quoted strings and identifiers first to avoid false positives
  const dangerous = [
    "DROP",
    "DELETE",
    "INSERT",
    "UPDATE",
    "ALTER",
    "CREATE",
    "TRUNCATE",
    "EXEC",
    "EXECUTE",
  ];

  // Remove quoted strings (single and double quotes)
  let sqlWithoutQuotes = upper;
  sqlWithoutQuotes = sqlWithoutQuotes.replace(/"[^"]*"/g, ""); // Remove double-quoted identifiers
  sqlWithoutQuotes = sqlWithoutQuotes.replace(/'[^']*'/g, ""); // Remove single-quoted strings

  // Check for dangerous keywords as standalone words (with word boundaries)
  for (const k of dangerous) {
    // Use word boundary regex to match only as a keyword, not as part of another word
    const keywordRegex = new RegExp(`\\b${k}\\b`, "i");
    if (keywordRegex.test(sqlWithoutQuotes)) {
      throw new Error(`Query contains forbidden keyword: ${k}`);
    }
  }
}

export function parseAllowedFromSchemaBlock(schemaBlock: string) {
  const allowed: Record<string, Set<string>> = {};
  const lines = schemaBlock.split("\n");
  for (const line of lines) {
    const m = line.match(/^\-\s+"([^"]+)"\:\s*(.+)$/);
    if (!m) continue;
    const table = m[1];
    const cols = m[2]
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    allowed[table] = new Set(cols);
  }
  return allowed;
}

export function validateIdentifiersAgainstSchema(sql: string, schemaBlock: string) {
  const allowed = parseAllowedFromSchemaBlock(schemaBlock);
  const allowedTables = new Set(Object.keys(allowed));

  // validate FROM/JOIN tables
  const tableRefs = [...sql.matchAll(/\b(from|join)\s+"([^"]+)"/gi)].map((m) => m[2]);
  for (const t of tableRefs) {
    if (!allowedTables.has(t)) {
      throw new Error(`Disallowed table referenced: "${t}"`);
    }
  }

  // validate qualified column refs "Table"."col"
  const colRefs = [...sql.matchAll(/"([^"]+)"\."([^"]+)"/g)].map((m) => ({ t: m[1], c: m[2] }));
  for (const { t, c } of colRefs) {
    if (!allowedTables.has(t)) {
      throw new Error(`Disallowed table referenced: "${t}"`);
    }
    const cols = allowed[t];
    if (cols && !cols.has(c)) {
      throw new Error(`Disallowed column referenced: "${t}"."${c}"`);
    }
  }
}
