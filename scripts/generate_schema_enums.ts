import fs from "node:fs";
import path from "node:path";

type EnumDef = {
  name: string;
  values: string[];
  usedInTables: Array<{
    table: string;
    mappedTable: string;
    field: string;
    mappedColumn: string;
  }>;
};

type ModelDef = {
  name: string;
  mappedTable: string;
  fields: Array<{
    name: string;
    mappedColumn: string;
    type: string;
    isOptional: boolean;
  }>;
};

function parsePrismaSchema(schemaText: string) {
  const lines = schemaText.split(/\r?\n/);
  const enums: EnumDef[] = [];
  const models: ModelDef[] = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();

    // Parse enum
    const enumMatch = line.match(/^enum\s+(\w+)\s*\{\s*$/);
    if (enumMatch) {
      const enumName = enumMatch[1];
      const values: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("}")) {
        const v = lines[i].trim();
        if (v && !v.startsWith("//")) {
          const val = v.split(/\s+/)[0].replace(/,$/, "");
          if (val) values.push(val);
        }
        i++;
      }
      enums.push({
        name: enumName,
        values,
        usedInTables: [],
      });
      i++;
      continue;
    }

    // Parse model
    const modelMatch = line.match(/^model\s+(\w+)\s*\{\s*$/);
    if (modelMatch) {
      const modelName = modelMatch[1];
      let mappedTable = modelName;
      const fields: ModelDef["fields"] = [];

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

        // Skip @@index and other model-level directives
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
        const typeToken = fieldMatch[2]; // could be String?, EnumType?, etc.
        const attrs = fieldMatch[3] || "";

        // Skip relation fields
        if (attrs.includes("@relation")) {
          i++;
          continue;
        }

        const isList = typeToken.endsWith("[]");
        const rawType = isList ? typeToken.slice(0, -2) : typeToken;
        const isOptional = rawType.endsWith("?");
        const baseType = isOptional ? rawType.slice(0, -1) : rawType;

        // Extract @map to get mapped column name
        const columnMapMatch = attrs.match(/@map\("([^"]+)"\)/);
        const mappedColumn = columnMapMatch ? columnMapMatch[1] : fieldName;

        fields.push({
          name: fieldName,
          mappedColumn,
          type: baseType,
          isOptional,
        });

        i++;
      }

      models.push({
        name: modelName,
        mappedTable,
        fields,
      });
      i++;
      continue;
    }

    i++;
  }

  // Map enums to tables/fields
  for (const enumDef of enums) {
    for (const model of models) {
      for (const field of model.fields) {
        if (field.type === enumDef.name) {
          enumDef.usedInTables.push({
            table: model.name,
            mappedTable: model.mappedTable,
            field: field.name,
            mappedColumn: field.mappedColumn,
          });
        }
      }
    }
  }

  return { enums, models };
}

async function main() {
  const repoRoot = path.resolve(__dirname, "..");
  const schemaPath = path.join(repoRoot, "prisma", "schema.prisma");
  const outputPath = path.join(repoRoot, "data", "schema_enums.json");

  if (!fs.existsSync(schemaPath)) {
    throw new Error(`Schema file not found: ${schemaPath}`);
  }

  const schemaText = fs.readFileSync(schemaPath, "utf8");
  const { enums } = parsePrismaSchema(schemaText);

  // Format output
  const output = {
    enums: enums.map((e) => ({
      name: e.name,
      values: e.values,
      usedInTables: e.usedInTables.map((u) => ({
        table: u.table,
        mappedTable: u.mappedTable,
        field: u.field,
        mappedColumn: u.mappedColumn,
      })),
    })),
  };

  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
  console.log(`Generated ${enums.length} enums in ${outputPath}`);
  console.log(
    `Enums: ${enums.map((e) => `${e.name}(${e.values.length} values, used in ${e.usedInTables.length} fields)`).join(", ")}`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
