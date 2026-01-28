import fs from "node:fs";
import path from "node:path";

type EnumDef = { name: string; values: string[] };

type ScalarField = {
  name: string;
  rawType: string; // e.g. String, DateTime?, Decimal?
  baseType: string; // e.g. String, DateTime
  isOptional: boolean;
  isList: boolean;
  mappedColumn: string;
  isId: boolean;
  isUnique: boolean;
  isUpdatedAt: boolean;
};

type ModelDef = {
  name: string;
  mappedTable: string;
  scalars: ScalarField[];
  // fkFieldName -> { targetModel, targetMappedTable, references[] }
  fkMap: Record<string, { targetModel: string; targetMappedTable: string; references: string[] }>;
  uniqueConstraints: string[][];
};

function splitCamelCase(s: string) {
  return s
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .toLowerCase()
    .trim();
}

function uniq<T>(arr: T[]) {
  return Array.from(new Set(arr));
}

function detectDomain(modelName: string) {
  if (modelName === "InventoryListing" || modelName.toLowerCase().includes("inventory"))
    return "inventory";
  if (modelName === "Offers" || modelName.toLowerCase().includes("offer")) return "offers";
  if (modelName.startsWith("Sale")) return "sales";
  if (modelName === "Chat" || modelName === "Message" || modelName.toLowerCase().includes("inbox"))
    return "chat";
  if (modelName === "User" || modelName === "Session" || modelName === "UserDealerRole")
    return "auth";
  if (modelName === "Admin" || modelName === "AdminSession") return "admin";
  if (modelName === "FineTuningSample") return "fine_tuning";
  return "general";
}

function importanceForField(model: ModelDef, field: ScalarField) {
  if (field.isId) return "high";
  if (model.fkMap[field.name]) return "high";

  const highNames = new Set([
    "vin",
    "dealNo",
    "dealerId",
    "userId",
    "adminId",
    "chatId",
    "createdAt",
    "updatedAt",
    "status",
    "make",
    "model",
    "year",
    "price",
    "msrp",
    "mileage",
    "brand",
    "offerType",
    "expirationDate",
    "offerAmount",
    "subject",
    "content",
    "email",
    "name",
    "role",
    "type",
    "question",
    "answer",
  ]);
  if (highNames.has(field.name)) return "high";

  // mapped columns often help NLQ for correctness
  if (field.mappedColumn !== field.name) return "medium";

  return "low";
}

function synonymsForField(model: ModelDef, field: ScalarField) {
  const base = uniq([splitCamelCase(field.name), splitCamelCase(field.mappedColumn)]).filter(
    Boolean,
  );

  const extra: string[] = [];
  // A few high-signal, schema-specific synonyms
  if (field.name === "vin")
    extra.push("vin", "vehicle vin", "chassis number", "vehicle identification number");
  if (field.name === "dealNo") extra.push("deal number", "deal id", "sale deal number");
  if (field.name === "dealerId") extra.push("dealer id", "dealership id", "store id");
  if (field.name === "offerType") extra.push("offer type", "offer category");
  if (field.name === "expirationDate") extra.push("expiration", "expires", "end date");
  if (field.name === "createdAt") extra.push("created date", "created time", "created at");
  if (field.name === "updatedAt") extra.push("updated date", "updated time", "updated at");
  if (field.name === "bodyStyle" || field.mappedColumn === "body_style")
    extra.push("body style", "vehicle type", "body");
  if (field.name === "msrp") extra.push("msrp", "sticker price");
  if (field.name === "price") extra.push("price", "sale price", "listing price");
  if (field.name === "mileage") extra.push("mileage", "odometer");
  if (field.name === "status") extra.push("status", "state");

  return uniq([...extra, ...base]).filter((s) => s.length > 0);
}

function parsePrismaSchema(schemaText: string) {
  const lines = schemaText.split(/\r?\n/);

  const enums: Record<string, EnumDef> = {};
  const models: ModelDef[] = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();

    // enum Foo { ... }
    const enumMatch = line.match(/^enum\s+(\w+)\s*\{\s*$/);
    if (enumMatch) {
      const name = enumMatch[1];
      const values: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("}")) {
        const v = lines[i].trim();
        if (v && !v.startsWith("//")) {
          const val = v.split(/\s+/)[0];
          if (val) values.push(val);
        }
        i++;
      }
      enums[name] = { name, values };
      i++;
      continue;
    }

    // model Foo { ... }
    const modelMatch = line.match(/^model\s+(\w+)\s*\{\s*$/);
    if (modelMatch) {
      const name = modelMatch[1];
      const scalars: ScalarField[] = [];
      const fkRefs: Array<{ relationTargetModel: string; fields: string[]; references: string[] }> =
        [];
      const uniqueConstraints: string[][] = [];
      let mappedTable = name;

      i++;
      while (i < lines.length && !lines[i].trim().startsWith("}")) {
        const raw = lines[i];
        const t = raw.trim();

        if (!t || t.startsWith("//")) {
          i++;
          continue;
        }

        // @@map("Table")
        const mapMatch = t.match(/^@@map\("([^"]+)"\)/);
        if (mapMatch) {
          mappedTable = mapMatch[1];
          i++;
          continue;
        }

        // @@unique([a, b], ...)
        const uniqMatch = t.match(/^@@unique\(\[([^\]]+)\]/);
        if (uniqMatch) {
          const fields = uniqMatch[1]
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
          if (fields.length > 0) uniqueConstraints.push(fields);
          i++;
          continue;
        }

        // Skip @@index, @@map handled above, and other model-level directives
        if (t.startsWith("@@")) {
          i++;
          continue;
        }

        // Field line: name Type ...attributes
        const fieldMatch = t.match(/^(\w+)\s+([^\s]+)\s*(.*)$/);
        if (!fieldMatch) {
          i++;
          continue;
        }

        const fieldName = fieldMatch[1];
        const typeToken = fieldMatch[2]; // could be Dealer, String?, Decimal?, Json?
        const attrs = fieldMatch[3] || "";

        const isList = typeToken.endsWith("[]");
        const rawType = isList ? typeToken.slice(0, -2) : typeToken;
        const isOptional = rawType.endsWith("?");
        const baseType = isOptional ? rawType.slice(0, -1) : rawType;

        // relation field if baseType matches a model name? we don't know yet. Detect by @relation(...)
        const relationMatch = attrs.match(/@relation\(([^)]*)\)/);
        if (relationMatch) {
          const relArgs = relationMatch[1];
          const fieldsMatch = relArgs.match(/fields:\s*\[([^\]]+)\]/);
          const refsMatch = relArgs.match(/references:\s*\[([^\]]+)\]/);
          const fields = fieldsMatch
            ? fieldsMatch[1]
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean)
            : [];
          const references = refsMatch
            ? refsMatch[1]
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean)
            : [];

          if (fields.length > 0 && references.length > 0) {
            fkRefs.push({
              relationTargetModel: baseType,
              fields,
              references,
            });
          }

          // relation field itself isn't a DB column; skip creating scalar doc for it
          i++;
          continue;
        }

        // Scalar field
        let mappedColumn = fieldName;
        const colMapMatch = attrs.match(/@map\("([^"]+)"\)/);
        if (colMapMatch) mappedColumn = colMapMatch[1];

        const isId = attrs.includes("@id");
        const isUnique = attrs.includes("@unique");
        const isUpdatedAt = attrs.includes("@updatedAt");

        scalars.push({
          name: fieldName,
          rawType: typeToken,
          baseType,
          isOptional,
          isList,
          mappedColumn,
          isId,
          isUnique,
          isUpdatedAt,
        });

        i++;
      }

      // Build fk map using mapped tables if possible (target table map resolved later)
      models.push({
        name,
        mappedTable,
        scalars,
        fkMap: {}, // filled later
        uniqueConstraints,
      });

      // Attach fkRefs temporarily by storing them on the model object via a symbol-ish property
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (models[models.length - 1] as any).__fkRefs = fkRefs;

      i++;
      continue;
    }

    i++;
  }

  // Resolve model name -> mapped table
  const modelToMappedTable: Record<string, string> = {};
  for (const m of models) modelToMappedTable[m.name] = m.mappedTable;

  // Fill fkMap
  for (const m of models) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fkRefs =
      ((m as any).__fkRefs as Array<{
        relationTargetModel: string;
        fields: string[];
        references: string[];
      }>) || [];

    for (const ref of fkRefs) {
      for (const fkField of ref.fields) {
        m.fkMap[fkField] = {
          targetModel: ref.relationTargetModel,
          targetMappedTable: modelToMappedTable[ref.relationTargetModel] || ref.relationTargetModel,
          references: ref.references,
        };
      }
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (m as any).__fkRefs;
  }

  return { enums, models };
}

function buildColumnDoc(model: ModelDef, field: ScalarField, enums: Record<string, EnumDef>) {
  const mappedTable = model.mappedTable;
  const mappedCol = field.mappedColumn;
  const importance = importanceForField(model, field);
  const domain = detectDomain(model.name);
  const synonyms = synonymsForField(model, field);

  const enumInfo = enums[field.baseType]
    ? ` Enum values: ${enums[field.baseType].values.join(", ")}.`
    : "";

  const fk = model.fkMap[field.name];
  const fkInfo = fk
    ? ` FK to ${fk.targetModel} (table "${fk.targetMappedTable}") via ${fk.references.join(", ")}.`
    : "";

  const uniqueInfoParts: string[] = [];
  if (field.isId) uniqueInfoParts.push("primary key");
  if (field.isUnique) uniqueInfoParts.push("unique");
  for (const uc of model.uniqueConstraints) {
    if (uc.includes(field.name)) {
      uniqueInfoParts.push(`part of unique(${uc.join(", ")})`);
    }
  }
  const uniqueInfo = uniqueInfoParts.length
    ? ` Constraints: ${uniq(uniqueInfoParts).join("; ")}.`
    : "";

  const text =
    `Column "${mappedTable}"."${mappedCol}" (Prisma: ${model.name}.${field.name}). ` +
    `Type: ${field.rawType}.` +
    fkInfo +
    uniqueInfo +
    (synonyms.length ? ` Synonyms: ${synonyms.join(", ")}.` : "") +
    enumInfo;

  const metadata: Record<string, any> = {
    kind: "column",
    table: model.name,
    mapped_table: mappedTable,
    column: field.name,
    mapped_column: mappedCol,
    type: field.rawType,
    importance,
    domain,
    synonyms,
    is_pk: field.isId || undefined,
    is_fk: Boolean(fk) || undefined,
    fk_target: fk ? `${fk.targetModel}(${fk.references.join(",")})` : undefined,
  };

  // remove undefined keys
  for (const k of Object.keys(metadata)) {
    if (metadata[k] === undefined) delete metadata[k];
  }

  return {
    id: `col:${model.name}.${field.name}`,
    text,
    metadata,
  };
}

function buildJoinEdges(models: ModelDef[]) {
  const edges: any[] = [];
  for (const m of models) {
    for (const [fkField, fk] of Object.entries(m.fkMap)) {
      const fkScalar = m.scalars.find((s) => s.name === fkField);
      if (!fkScalar) continue;

      for (const refCol of fk.references) {
        edges.push({
          from_table: m.name,
          from_mapped_table: m.mappedTable,
          from_column: fkField,
          from_mapped_column: fkScalar.mappedColumn,
          to_table: fk.targetModel,
          to_mapped_table: fk.targetMappedTable,
          to_column: refCol,
          to_mapped_column: refCol, // we don't resolve @map on target id here
        });
      }
    }
  }
  return edges;
}

function truncate(s: string, maxLen: number) {
  if (s.length <= maxLen) return s;
  return s.slice(0, maxLen);
}

function tableSynonyms(model: ModelDef) {
  return uniq([splitCamelCase(model.name), splitCamelCase(model.mappedTable)]).filter(Boolean);
}

function buildTableDoc(model: ModelDef, enums: Record<string, EnumDef>) {
  const domain = detectDomain(model.name);
  const synonyms = tableSynonyms(model);

  const scalars = model.scalars.filter((f) => !f.isList);
  const ordered = [...scalars].sort((a, b) => {
    const ia = importanceForField(model, a);
    const ib = importanceForField(model, b);
    const rank = (x: string) => (x === "high" ? 3 : x === "medium" ? 2 : 1);
    return rank(ib) - rank(ia);
  });

  const colsLines = ordered.map((f) => {
    const imp = importanceForField(model, f);
    const fk = model.fkMap[f.name];
    const fkInfo = fk ? ` FK-> ${fk.targetMappedTable}(${fk.references.join(",")})` : "";
    const syn = synonymsForField(model, f);
    const enumInfo = enums[f.baseType] ? ` enum[${enums[f.baseType].values.join(", ")}]` : "";
    const mapped = f.mappedColumn;
    return `- ${mapped} (Prisma: ${f.name}, type: ${f.rawType}, importance: ${imp})${fkInfo}${
      syn.length ? `; synonyms: ${syn.join(", ")}` : ""
    }${enumInfo}`;
  });

  const uniqueLines: string[] = [];
  for (const uc of model.uniqueConstraints) {
    uniqueLines.push(`- unique(${uc.join(", ")})`);
  }

  const fkFields = ordered.filter((f) => Boolean(model.fkMap[f.name]));
  const fkLines = fkFields.map((f) => {
    const fk = model.fkMap[f.name]!;
    return `- ${model.mappedTable}.${f.mappedColumn} -> ${fk.targetMappedTable}.${fk.references.join(", ")}`;
  });

  const text = truncate(
    [
      `Table "${model.mappedTable}" (Prisma model: ${model.name}).`,
      `Domain: ${domain}.`,
      synonyms.length ? `Table synonyms: ${synonyms.join(", ")}.` : "",
      ``,
      `Columns (Postgres identifiers):`,
      ...colsLines,
      ``,
      uniqueLines.length ? `Unique constraints:\n${uniqueLines.join("\n")}` : "",
      ``,
      fkLines.length ? `Foreign keys / join hints:\n${fkLines.join("\n")}` : "",
    ]
      .filter(Boolean)
      .join("\n"),
    9000,
  );

  const metadata: Record<string, any> = {
    kind: "table",
    table: model.name,
    mapped_table: model.mappedTable,
    domain,
    synonyms,
  };

  return {
    id: `tbl:${model.name}`,
    text,
    metadata,
  };
}

function chooseFieldsForModel(model: ModelDef) {
  const scalarCount = model.scalars.length;
  const huge = scalarCount >= 60;

  if (!huge) return model.scalars;

  const always = new Set<string>([
    "id",
    "createdAt",
    "updatedAt",
    "dealerId",
    "dealNo",
    "status",
    "vin",
    "make",
    "model",
    "year",
    "price",
    "msrp",
    "mileage",
  ]);

  return model.scalars.filter((f) => {
    if (f.isId) return true;
    if (model.fkMap[f.name]) return true;
    if (always.has(f.name)) return true;
    if (f.mappedColumn !== f.name) return true;
    return false;
  });
}

function main() {
  const repoRoot = path.resolve(__dirname, "..");
  const schemaPath = path.join(repoRoot, "prisma", "schema.prisma");
  const outDir = path.join(repoRoot, "data");
  const outColumns = path.join(outDir, "schema_column_docs.json");
  const outJoins = path.join(outDir, "schema_join_graph.json");
  const outTables = path.join(outDir, "schema_table_docs.json");

  const schema = fs.readFileSync(schemaPath, "utf8");
  const { enums, models } = parsePrismaSchema(schema);

  const columnDocs: any[] = [];
  for (const model of models) {
    const fields = chooseFieldsForModel(model);
    for (const field of fields) {
      // Skip list scalars (shouldn't happen in this schema for db columns)
      if (field.isList) continue;
      columnDocs.push(buildColumnDoc(model, field, enums));
    }
  }

  const joinEdges = buildJoinEdges(models);
  const tableDocs = models.map((m) => buildTableDoc(m, enums));

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outColumns, JSON.stringify(columnDocs, null, 2));
  fs.writeFileSync(outJoins, JSON.stringify(joinEdges, null, 2));
  fs.writeFileSync(outTables, JSON.stringify(tableDocs, null, 2));

  // eslint-disable-next-line no-console
  console.log(`Wrote ${columnDocs.length} column docs -> ${path.relative(repoRoot, outColumns)}`);
  // eslint-disable-next-line no-console
  console.log(`Wrote ${joinEdges.length} join edges -> ${path.relative(repoRoot, outJoins)}`);
  // eslint-disable-next-line no-console
  console.log(`Wrote ${tableDocs.length} table docs -> ${path.relative(repoRoot, outTables)}`);
}

main();
