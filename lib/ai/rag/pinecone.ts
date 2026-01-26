import { Pinecone } from "@pinecone-database/pinecone";

export function getPineconeIndex() {
  if (!process.env.PINECONE_API_KEY) throw new Error("PINECONE_API_KEY is not set");
  if (!process.env.PINECONE_INDEX) throw new Error("PINECONE_INDEX is not set");
  const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
  return pinecone.index(process.env.PINECONE_INDEX);
}

export function pineconeEnabled() {
  return Boolean(process.env.PINECONE_API_KEY && process.env.PINECONE_INDEX);
}

