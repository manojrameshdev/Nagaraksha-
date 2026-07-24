import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { zaiChat } from "@/lib/zai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SYSTEM_PROMPT = `You are NagRaksha Mitra, a calm, clinically careful assistant that answers questions about snakes and snakebites in India.

BRAND VOICE (must follow):
- Calm urgency. Clinical clarity. Rural accessibility.
- Short, plain-language answers. No jargon, no panic, no false reassurance.
- "SOS sent. Looking for responders." not "Everything will be okay."
- "Antivenom stock reported available · verified 8 min ago." not "Antivenom guaranteed."

SAFETY RULES (hard):
1. If the user describes a bite that is happening now, or someone is symptomatic, DO NOT answer casually. Reply with exactly: "This sounds like an emergency. Tap SOS now and get to a hospital — do not wait. Keep the person still." Then stop.
2. Never recommend folk remedies: do NOT suggest cutting the wound, sucking out venom, applying tourniquets tightly, ice, or herbal pastes. If asked about them, explain plainly why they do not help and can harm.
3. Never claim certainty about a snake species from a description. Always say identification is uncertain and medical care must not wait.
4. Never recommend an antivenom dose. Dosage is decided by a doctor at the hospital.
5. Keep answers under 120 words unless the user asks for detail.

If the question is a common myth, mark it: start your answer with "MYTH: " then the myth, then "FACT: " then the correction.`;

const FALLBACKS: { match: RegExp; answer: string; myth: boolean }[] = [
  {
    match: /tourniquet|tie|tight band/i,
    myth: true,
    answer:
      "MYTH: Tie a tight tourniquet above the bite to stop venom spread.\nFACT: Tight tourniquets cause tissue damage, gangrene and wrong-first-aid amputations. Instead, immobilise the bitten limb with a splint at heart level and get to a hospital. NagRaksha SOS routes you to a hospital with confirmed antivenom.",
  },
  {
    match: /suck|cut|incis/i,
    myth: true,
    answer:
      "MYTH: Cut the wound and suck out the venom.\nFACT: Cutting and sucking does not remove meaningful venom and adds infection risk. Keep the person still, immobilise the limb, and transport to a hospital — that is the only proven first aid.",
  },
  {
    match: /ice|cold compress|chill/i,
    myth: true,
    answer:
      "MYTH: Apply ice to the bite to slow venom.\nFACT: Ice does not neutralise venom and can damage skin. Immobilise the limb and get to a hospital with antivenom.",
  },
  {
    match: /herbal|jhad|phoonk|mantra|traditional healer|ojha/i,
    myth: true,
    answer:
      "MYTH: A traditional healer, mantra, or herbal paste can treat snakebite.\nFACT: Time to hospital is the single biggest factor in survival. Healers are valued in the community, but for a bite, go to a hospital first. NagRaksha connects a trained first responder to you while the ambulance is en route.",
  },
  {
    match: /guarantee|certain|definitely|sure it is/i,
    myth: true,
    answer:
      "MYTH: A photo can guarantee the snake species.\nFACT: Photo identification is assistive and uncertain. Even a likely match is not a diagnosis. If bitten, do not wait for a confirmed ID — trigger SOS and reach a hospital.",
  },
];

// POST /api/myth-buster — conversational assistant (FR-5.1, FR-5.2, FR-5.3).
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const question: string = String(body?.question ?? "").trim();
  if (!question) {
    return NextResponse.json({ error: "Question is required" }, { status: 400 });
  }

  // Emergency guard (FR-5.3) — short-circuit before the LLM.
  const emergency =
    /bitten|bit me|bite (now|just)|snake just|symptom|swelling|bleeding|can't breathe|unconscious|dying|now help|help now/i.test(
      question
    );
  if (emergency) {
    const answer =
      "This sounds like an emergency. Tap SOS now and get to a hospital — do not wait. Keep the person still.";
    return NextResponse.json({ answer, emergency: true, mythFlagged: false, source: "guard" });
  }

  let answer: string | null = null;
  let mythFlagged = false;

  // Try the LLM with a hard system prompt.
  answer = await zaiChat([
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: question },
  ]);

  if (answer && answer.trim().length > 0) {
    mythFlagged = /MYTH:/i.test(answer);
    await db.mythThread
      .create({ data: { question, answer, mythFlagged } })
      .catch(() => {});
    return NextResponse.json({ answer, emergency: false, mythFlagged, source: "llm" });
  }

  // Fallback — curated myth busting.
  const hit = FALLBACKS.find((f) => f.match.test(question));
  if (hit) {
    answer = hit.answer;
    mythFlagged = true;
  } else {
    answer =
      "I'm NagRaksha Mitra. I can help with snake facts, first-aid do's and don'ts, and common myths. If you or someone near you has been bitten, please tap SOS now — do not wait. For a specific question, ask me about a snake species, a first-aid step, or a remedy you've heard of.";
  }
  await db.mythThread.create({ data: { question, answer, mythFlagged } }).catch(() => {});
  return NextResponse.json({ answer, emergency: false, mythFlagged, source: "fallback" });
}
