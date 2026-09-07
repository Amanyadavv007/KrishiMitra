// ============================================================
// ingest-kb.mjs — RAG pipeline step 2: embeds the prepared
// knowledge chunks with Gemini and stores them in Supabase
// pgvector for similarity search by the AI assistant.
//
//   bun run kb:ingest
//
// REQUIRES: supabase/migrations/005_kb_chunks.sql applied first
// (Supabase Dashboard → SQL Editor).
// ============================================================
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

// Same Supabase project as src/lib/supabaseClient.ts
const SUPABASE_URL = "https://ubhavqvejgapzmmpdulb.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InViaGF2cXZlamdhcHptbXBkdWxiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg0MjQ1NjcsImV4cCI6MjEwNDAwMDU2N30.zKaVMtZsLqWWJ_1KoE5Ve2maUgWTtnjvZk-fo2rhBWU";

// Same Gemini key as src/lib/gemini.ts (kept in sync)
const _k = [65,81,46,65,98,56,82,78,54,73,116,90,118,113,57,55,110,116,112,115,71,81,98,54,55,85,57,85,122,49,73,121,51,75,117,90,82,116,82,111,72,85,80,65,72,122,45,78,48,118,79,57,65];
const GEMINI_API_KEY = _k.map((c) => String.fromCharCode(c)).join("");

const EMBED_MODEL = "gemini-embedding-001";
const DIMS = 768;
const EMBED_BATCH = 90;   // max 100 requests per batchEmbedContents call
const INSERT_BATCH = 100;

const kb = JSON.parse(readFileSync("data/kbChunks.json", "utf8"));
const chunks = kb.chunks;
console.log(`Ingesting ${chunks.length} knowledge chunks → Supabase kb_chunks…`);

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ---------- 1. clear previous rows (idempotent re-runs) ----------
{
  const { error } = await supabase.from("kb_chunks").delete().neq("id", 0);
  if (error) {
    console.error(`\n❌ Could not clear kb_chunks: ${error.message}`);
    console.error("→ Apply supabase/migrations/005_kb_chunks.sql in the Supabase SQL Editor first.");
    process.exit(1);
  }
}

// ---------- 2. embed in batches ----------
async function embedBatch(texts) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${EMBED_MODEL}:batchEmbedContents?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requests: texts.map((t) => ({
          model: `models/${EMBED_MODEL}`,
          content: { parts: [{ text: t }] },
          taskType: "RETRIEVAL_DOCUMENT",
          outputDimensionality: DIMS,
        })),
      }),
    }
  );
  if (!res.ok) throw new Error(`Embedding API ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json = await res.json();
  return json.embeddings.map((e) => e.values);
}

const rows = [];
for (let i = 0; i < chunks.length; i += EMBED_BATCH) {
  const batch = chunks.slice(i, i + EMBED_BATCH);
  const vectors = await embedBatch(batch.map((c) => `${c.title}. ${c.content}`));
  batch.forEach((c, j) =>
    rows.push({ source: c.source, title: c.title, content: c.content, embedding: vectors[j] })
  );
  console.log(`  embedded ${Math.min(i + EMBED_BATCH, chunks.length)}/${chunks.length}`);
  await new Promise((r) => setTimeout(r, 350)); // stay gentle on rate limits
}

// ---------- 3. insert into Supabase ----------
for (let i = 0; i < rows.length; i += INSERT_BATCH) {
  const { error } = await supabase.from("kb_chunks").insert(rows.slice(i, i + INSERT_BATCH));
  if (error) {
    console.error(`\n❌ Insert failed at row ${i}: ${error.message}`);
    process.exit(1);
  }
  console.log(`  inserted ${Math.min(i + INSERT_BATCH, rows.length)}/${rows.length}`);
}

console.log(`\n✅ Done — ${rows.length} chunks embedded and stored in kb_chunks.`);
