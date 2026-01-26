import path from "node:path";
import { embedText } from "../../lib/ai/rag/embeddings";
import fs from "node:fs";
import dotenv from "dotenv";

function loadEnvFiles() {
  const cwd = process.cwd();
  const envPath = path.join(cwd, ".env");
  const envLocalPath = path.join(cwd, ".env.local");
  if (fs.existsSync(envPath)) dotenv.config({ path: envPath });
  if (fs.existsSync(envLocalPath)) dotenv.config({ path: envLocalPath, override: true });
}

async function readStdin(): Promise<string> {
  return await new Promise((resolve, reject) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => (data += chunk));
    process.stdin.on("end", () => resolve(data));
    process.stdin.on("error", reject);
  });
}

async function main() {
  loadEnvFiles();

  const argText = process.argv.slice(2).join(" ").trim();
  const stdinText = argText ? "" : (await readStdin()).trim();
  const text = (argText || stdinText).trim();

  if (!text) {
    // eslint-disable-next-line no-console
    console.error('Usage: npm run test:embed -- "some text"\nOr: echo "some text" | npm run test:embed');
    process.exit(1);
  }

  const vec = await embedText(text);

  // eslint-disable-next-line no-console
  const filePath = path.join(process.cwd(), "scripts", "test", "vector.txt");
  fs.writeFileSync(filePath, vec.join(", "));
  // eslint-disable-next-line no-console
  console.log(`Wrote ${filePath}`);
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});

