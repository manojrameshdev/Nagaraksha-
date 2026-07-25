// NagRaksha RAG layer.
//
// Retrieval: lightweight TF-IDF over the curated KnowledgeChunk corpus.
//   We deliberately avoid an external embedding model (none bundled in the
//   z-ai-web-dev-sdk) and instead build an in-process TF-IDF index that is
//   perfectly adequate for a curated, ~22-chunk medical corpus. Retrieval is
//   the "R" of RAG; the LLM call is the "G", augmented with cited chunks.
//
// Generation: z-ai-web-dev-sdk chat completion, with the retrieved chunks
//   injected into the system prompt as authoritative, cited context. The LLM
//   is instructed to stay within the retrieved context and to cite docIds.

import { db } from "@/lib/db";
import { zaiChat } from "@/lib/zai";
import type { KnowledgeChunk } from "@prisma/client";

export interface RetrievedChunk {
  id: string;
  docId: string;
  title: string;
  category: string;
  content: string;
  score: number;
}

// ---- TF-IDF index (lazy, memoised on globalThis to survive HMR) ----
type Index = {
  chunks: { id: string; docId: string; title: string; category: string; content: string; tags: string }[];
  docFreq: Map<string, number>;
  tf: Map<string, { term: string; freq: number }[]>;
  n: number;
};

const GLOBAL = globalThis as unknown as { __nagrakshaRagIndex?: Index; __nagrakshaRagBuilt?: number };

async function buildIndex(): Promise<Index> {
  const chunks = await db.knowledgeChunk.findMany();
  const stop = new Set([
    "a","an","the","is","are","was","were","be","been","being","to","of","in","on","at","for","and","or","but","if","then","do","does","did","not","no","i","you","he","she","it","we","they","this","that","these","those","with","from","by","as","can","will","should","would","may","might","must","into","out","up","down","my","your","his","her","its","our","their","me","him","us","them","what","when","where","why","how","who","which","whom","than","so","such","too","very","just","also","about","than"
  ]);
  const tokenize = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 2 && !stop.has(t));

  const tf = new Map<string, { term: string; freq: number }[]>();
  const docFreq = new Map<string, number>();
  for (const c of chunks) {
    const text = `${c.title} ${c.tags ?? ""} ${c.content}`;
    const tokens = tokenize(text);
    const freqMap = new Map<string, number>();
    for (const t of tokens) freqMap.set(t, (freqMap.get(t) ?? 0) + 1);
    const arr = [...freqMap.entries()].map(([term, freq]) => ({ term, freq }));
    tf.set(c.id, arr);
    for (const term of freqMap.keys()) docFreq.set(term, (docFreq.get(term) ?? 0) + 1);
  }
  const index: Index = {
    chunks: chunks.map((c) => ({
      id: c.id,
      docId: c.docId,
      title: c.title,
      category: c.category,
      content: c.content,
      tags: c.tags ?? "",
    })),
    docFreq,
    tf,
    n: chunks.length,
  };
  return index;
}

async function getIndex(): Promise<Index> {
  // rebuild if not built or corpus size changed
  const count = await db.knowledgeChunk.count();
  if (!GLOBAL.__nagrakshaRagIndex || GLOBAL.__nagrakshaRagBuilt !== count) {
    GLOBAL.__nagrakshaRagIndex = await buildIndex();
    GLOBAL.__nagrakshaRagBuilt = count;
  }
  return GLOBAL.__nagrakshaRagIndex;
}

const stop = new Set([
  "a","an","the","is","are","was","were","be","to","of","in","on","at","for","and","or","but","do","does","not","no","i","you","it","this","that","with","from","by","as","can","will","should","my","your","what","when","where","why","how","which","should","would","may","might"
]);

function queryTokens(q: string): string[] {
  return q
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2 && !stop.has(t));
}

/** Retrieve the top-k most relevant chunks for a natural-language query. */
export async function retrieve(query: string, k = 4): Promise<RetrievedChunk[]> {
  const index = await getIndex();
  const qTokens = queryTokens(query);
  if (qTokens.length === 0) return [];
  const N = index.n || 1;

  // query vector: idf weighting
  const qVec = new Map<string, number>();
  for (const t of qTokens) {
    const df = index.docFreq.get(t) ?? 0;
    const idf = Math.log((N + 1) / (df + 1)) + 1;
    qVec.set(t, (qVec.get(t) ?? 0) + idf);
  }

  const scored: RetrievedChunk[] = [];
  for (const c of index.chunks) {
    const tfArr = index.tf.get(c.id) ?? [];
    let score = 0;
    for (const { term, freq } of tfArr) {
      const q = qVec.get(term);
      if (!q) continue;
      const df = index.docFreq.get(term) ?? 0;
      const idf = Math.log((N + 1) / (df + 1)) + 1;
      const tfidf = (freq / (tfArr.length || 1)) * idf;
      score += q * tfidf;
    }
    // category boost: MYTH + FIRST_AID are the highest-value categories for
    // general questions, so give them a small lift to break ties.
    if (c.category === "MYTH") score *= 1.08;
    if (c.category === "FIRST_AID") score *= 1.06;
    if (score > 0) {
      scored.push({
        id: c.id,
        docId: c.docId,
        title: c.title,
        category: c.category,
        content: c.content,
        score: Math.round(score * 1000) / 1000,
      });
    }
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, k);
}

/** RAG-augmented generation for the NagRaksha myth-buster / assistant. */
export async function ragAnswer(
  question: string
): Promise<{ answer: string; sources: RetrievedChunk[]; source: string }> {
  const retrieved = await retrieve(question, 4);

  // Emergency guard (FR-5.3) — short-circuit before the LLM.
  if (
    /bitten|bit me|bite (now|just)|snake just|symptom|swelling|bleeding|can't breathe|cannot breathe|unconscious|dying|now help|help now|emergency/i.test(
      question
    )
  ) {
    return {
      answer:
        "This sounds like an emergency. Tap SOS now and get to a hospital — do not wait. Keep the person still.",
      sources: retrieved,
      source: "guard",
    };
  }

  const contextBlock = retrieved
    .map(
      (r, i) =>
        `[${i + 1}] (${r.category}) ${r.title}\n    ${r.content}\n    — source: ${r.docId}`
    )
    .join("\n\n");

  const systemPrompt = `You are NagRaksha Mitra, a calm, clinically careful assistant answering questions about snakes and snakebites in India.

You are given a RETRIEVED KNOWLEDGE BASE below. It is curated and medically reviewed. Answer the user's question using ONLY this retrieved context. If the retrieved context does not contain the answer, say plainly that you do not have reviewed information on that, and suggest they reach a hospital or trigger SOS.

BRAND VOICE:
- Calm urgency. Clinical clarity. Rural accessibility.
- Short, plain-language answers. No jargon, no panic, no false reassurance.
- "SOS sent. Looking for responders." not "Everything will be okay."

SAFETY (hard rules):
1. Never recommend folk remedies: cutting, sucking, tourniquets, ice, herbal pastes, mantras.
2. Never claim certainty about a snake species from a description or photo.
3. Never recommend an antivenom dose — dosage is decided by a doctor at the hospital.
4. If the question sounds like an active emergency, reply ONLY: "This sounds like an emergency. Tap SOS now and get to a hospital — do not wait. Keep the person still." Then stop.
5. Keep the answer under 130 words unless detail is explicitly requested.

If the user's question is about a common myth, begin with "MYTH: " then the myth, then "FACT: " then the corrected guidance.
Cite sources at the end of the answer as a short list, e.g. "Sources: first-aid-immobilisation, myth-tourniquet" — using only the docIds of the chunks you actually used.

RETRIEVED KNOWLEDGE BASE:
${contextBlock || "(no relevant chunks retrieved)"}`;

  const llm = await zaiChat([
    { role: "system", content: systemPrompt },
    { role: "user", content: question },
  ]);

  if (llm && llm.trim().length > 0) {
    return {
      answer: llm.trim(),
      sources: retrieved,
      source: "rag-llm",
    };
  }

  // Fallback: return the top retrieved chunk verbatim (still grounded).
  const top = retrieved[0];
  if (top) {
    return {
      answer: `${top.title}\n\n${top.content}\n\nSources: ${top.docId}`,
      sources: retrieved,
      source: "rag-retrieval-only",
    };
  }

  return {
    answer:
      "I'm NagRaksha Mitra. I can help with snake facts, first-aid do's and don'ts, and common myths. If someone has been bitten, please tap SOS now — do not wait.",
    sources: [],
    source: "fallback",
  };
}
