## Fine-tuning + NLQ guide (internal)

### 1) Target architecture (production-proven)

**Inputs**
- NL question from user
- DB schema (Prisma/Postgres)

**Components**
- **Schema Store**
  - Vector DB for schema search (columns, optional tables)
  - Structured join graph store (FK edges)
- **Example Store** (optional but helpful)
  - Vector DB for (NL, SQL) examples
- **Compiler**
  - Turns retrieval results into a compact schema block (tables/cols/joins)
- **SQL Generator**
  - LLM that outputs SQL only
- **Validator + Repair loop**
  - parse + schema-check + EXPLAIN, then 0–1 repair attempt

### 2) Build the schema store

#### 2.1 Store column docs in the vector DB (required)
One document per column (or per “important” column for huge tables).

**What to embed (text)**
- table meaning + column meaning
- synonyms
- Prisma mapped names (`@@map`, `@map`)
- common phrases (“deal number”, “VIN”, “dealer name”)

**What to store as metadata (not embedded)**
- table, mapped_table
- column, mapped_column
- type
- is_pk, is_fk
- fk_target (if FK)
- domain tags: inventory / sales / chat / auth / admin

**Example column doc ideas (based on schema)**
- `InventoryListing.bodyStyle` should include mapped column `body_style`
- `InventoryListing.dealerId` should include FK target `Dealer.id`
- `SaleData.dealNo` should include synonyms “deal number”

#### 2.2 Store join graph in structured form (required)
Store joins as JSON or a DB table (no need to embed joins unless you want to).

Each edge:
- from_table, from_mapped_table, from_column, from_mapped_column
- to_table, to_mapped_table, to_column, to_mapped_column

Core edges include:
- `Inventory(dealerId)` → `Dealer(id)`
- `SaleData(dealerId)` → `Dealer(id)`
- `SaleVehicle(saleDataId)` → `SaleData(id)`
- `Chat(userId)` → `User(id)`
- `Message(chatId)` → `Chat(id)`
- `UserDealerRole(userId)` → `User(id)`
- `UserDealerRole(dealerId)` → `Dealer(id)`

#### 2.3 Store table docs in the vector DB (optional)
Only needed if users ask vague questions. Keep them short:
- table purpose
- synonyms
- key columns + key relations

### 3) Retrieval strategy (token-efficient and robust)

#### 3.1 Column-first retrieval (best default)
Given NL input:
- Retrieve top N=50 column docs (global)
- Group by mapped_table to infer candidate tables

Score each table by:
- count of “strong” columns
- sum of top scores

**Strong column definition (adaptive)**
- Let `best = top_column_score`
- A column is “strong” if `score >= best * 0.85`
- Keep tables if they have:
  - ≥ 2 strong columns, OR
  - 1 very strong column (`>= best * 0.92`)
- Cap to max 6 tables (token safety)

#### 3.2 Select which columns to include (per chosen table)
For each selected table, include:
- Always: PK + FK columns (from metadata)
- Then: top-matching columns (by score)
- Cap to max 12 columns/table

#### 3.3 Add relations
From join graph:
- include only edges where both endpoints are in selected tables
- cap relations to a minimal “needed to connect” set (ideally a minimal spanning set)

### 4) Compile the “schema context block” (key)
Do not paste raw docs. Generate a compact deterministic block.

Rules:
- Use mapped table names (`@@map`) and mapped column names (`@map`)
- Use explicit join lines
- Keep one short meaning line per table if helpful

Template:
```
SCHEMA (Postgres). Use ONLY these identifiers.

Tables:
- "<TableA>": col1, col2, col3...
- "<TableB>": col1, col2...

Joins:
- "<TableB>"."<fk>" = "<TableA>"."<pk>"
- ...
```

Example (inventory):
```
Tables:
- "Dealer": id, name
- "Inventory": id, dealerId, vin, year, make, model, trim, body_style, price, status

Joins:
- "Inventory"."dealerId" = "Dealer"."id"
```

### 5) Examples RAG (optional)
Store NL↔SQL examples in a vector DB with metadata:
- tables_used
- domain
- pattern (aggregation, list, trend)

Retrieve 2–5 examples filtered by:
- same domain and/or overlapping tables

### 6) Prompt that works (copy/paste)
You are a Postgres SQL generator. Return ONLY a single SQL query. No explanation. No markdown.

Hard rules:
- Use ONLY the tables/columns listed in SCHEMA.
- Do not invent columns.
- Use double quotes for table/column identifiers.
- Use single quotes for string literals.
- If the question lacks a needed detail, make a reasonable assumption.

```
SCHEMA:
{compiled_schema_block}

Similar examples (optional):
{few_examples}

Task:
{user_nl}
```

### 7) Validation + repair (recommended)
After generation:
- Static schema check (parse identifiers, ensure tables/columns exist in allowed set)
- EXPLAIN on Postgres (ideally read-only)
- If error: feed back error + same schema block, allow one repair attempt

### 8) Model choice
- **gpt-4.1-mini**: long context + solid SQL generation
- **gpt-4.1**: best accuracy for complex joins/aggregations
- **gpt-4o-mini**: works if you rely more on validation/repair

### 9) Suggested starting parameters (safe defaults)
- Column retrieval topN: 50
- Strong column cutoff: >= best * 0.85
- Very-strong cutoff: >= best * 0.92
- Tables cap: 6
- Columns cap: 12 per table
- Relations: only between selected tables, minimal set to connect graph
- Examples: 2–5
- Repair attempts: 1

### 10) Implementation checklist (order)
- Parse Prisma → produce:
  - list of tables (mapped names)
  - list of columns (mapped names)
  - join graph edges
- Create column docs and upsert to vector DB
- (Optional) create table docs and example docs
- Implement retrieval (column-first)
- Implement compiler (schema block generator)
- Implement SQL generation prompt
- Implement validator + repair

### 11) Pinecone (vector DB) integration for sample store
If you want similarity search over your fine-tuning samples (NLQ/FAQ), store them in Pinecone at creation time and during bulk import.

**Recommended vector**
- Embed **question** (primary retrieval key). Store `answer` as metadata (or fetch from DB by id).

**Suggested env vars**
- `PINECONE_API_KEY`
- `PINECONE_INDEX`
- `PINECONE_NAMESPACE_NLP` (optional, default: `fine_tuning_nlq`) — NLQ examples/samples
- `PINECONE_NAMESPACE_FAQ` (optional, default: `fine_tuning_faq`) — FAQ samples
- `OPENAI_EMBEDDING_MODEL` (optional, default: `text-embedding-3-small`)

**Vector ID strategy**
- Use DB primary key (`FineTuningSample.id`) as Pinecone vector id.

### 12) Schema column docs → Pinecone upsert (script)
This repo includes a script that upserts `data/schema_column_docs.json` into Pinecone (namespace `schema_columns` by default).

Run:
```bash
npm run upsert:schema-columns
```

Env vars:
- `OPENAI_API_KEY`
- `OPENAI_EMBEDDING_MODEL` (optional)
- `PINECONE_API_KEY`
- `PINECONE_INDEX`
- `PINECONE_NAMESPACE_SCHEMA` (optional, default: `schema_columns`)

### 12b) Schema table docs → Pinecone upsert (script)
This repo also includes a script that upserts `data/schema_table_docs.json` into Pinecone (namespace `schema_tables` by default). Table docs are used to retrieve relevant tables first, then retrieve columns within those tables for SQL generation.

Run:
```bash
npm run upsert:schema-tables
```

Env vars:
- `OPENAI_API_KEY`
- `OPENAI_EMBEDDING_MODEL` (optional)
- `PINECONE_API_KEY`
- `PINECONE_INDEX`
- `PINECONE_NAMESPACE_SCHEMA_TABLES` (optional, default: `schema_tables`)


