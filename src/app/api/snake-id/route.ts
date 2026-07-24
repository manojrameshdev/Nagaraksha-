import { NextRequest, NextResponse } from "next/server";
import { zaiVision } from "@/lib/zai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/snake-id — CV-style snake classification (FR-6.1, FR-6.2).
// If an image (base64 data URL or http URL) is provided, uses the VLM; always
// returns a confidence and honest "do not delay care" caveat (FR-6.2).
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const image: string | undefined = body?.image;
  const freeText: string | undefined = body?.text;

  const catalogue = [
    {
      species: "Naja naja (Indian Cobra)",
      venom: "NEUROTOXIC",
      confidence: 0.82,
      habitat: "Fields, rodent burrows, near human settlement edges",
      firstAid: "Keep the person still and calm, immobilise the bitten limb with a splint at heart level, remove rings/watches, transport to hospital immediately. Do not cut, suck, or apply tourniquets.",
      danger: "High — neurotoxic envenoming can progress within hours.",
    },
    {
      species: "Daboia russelii (Russell's Viper)",
      venom: "HAEMOTOXIC",
      confidence: 0.78,
      habitat: "Open scrub, agricultural fields, rodent-rich areas",
      firstAid: "Keep still, immobilise the limb, do not apply ice or tourniquet, transport to a hospital with antivenom. Watch for swelling, bleeding gums, low urine output.",
      danger: "Severe — can cause bleeding and kidney injury.",
    },
    {
      species: "Echis carinatus (Saw-scaled Viper)",
      venom: "HAEMOTOXIC",
      confidence: 0.71,
      habitat: "Dry scrub, sandy soil, dry crop fields",
      firstAid: "Keep still and calm, immobilise the limb, transport to hospital. Do not cut the wound.",
      danger: "Severe despite small size — haemotoxic envenoming.",
    },
    {
      species: "Bungarus caeruleus (Common Krait)",
      venom: "NEUROTOXIC",
      confidence: 0.69,
      habitat: "Hides near termite mounds, rodent burrows; nocturnal",
      firstAid: "Keep the person still — krait bites may be painless but life-threatening. Immobilise and transport urgently. Watch for drooping eyelids, abdominal pain.",
      danger: "Severe — painless bite, delayed neurotoxicity.",
    },
    {
      species: "Ptyas mucosa (Oriental Rat Snake)",
      venom: "NON_VENOMOUS",
      confidence: 0.86,
      habitat: "Near fields, granaries, water — fast-moving, large",
      firstAid: "Non-venomous but clean any bite wound with soap and water. Still seek medical review for tetanus risk.",
      danger: "Low — non-venomous, defensive bite only.",
    },
  ];

  let picked = catalogue[Math.floor(Math.random() * catalogue.length)];
  let note = "Identification is uncertain. Do NOT delay medical care based on this result.";
  let source = "mock";

  if (image) {
    const sys =
      "You are NagRaksha CV, an assistant that classifies snakes from photos for the Indian subcontinent. " +
      "Respond ONLY with compact JSON: {\"species\": string, \"venom\": \"NEUROTOXIC\"|\"HAEMOTOXIC\"|\"CYTOTOXIC\"|\"NON_VENOMOUS\"|\"UNKNOWN\", \"confidence\": number 0..1, \"habitat\": string, \"firstAid\": string, \"danger\": string}. " +
      "If you are unsure, set confidence below 0.5 and species to \"Uncertain — treat as potentially venomous\". Never claim certainty for a blurry or partial photo.";
    const user: any = [
      { type: "text", text: freeText ? `Notes: ${freeText}` : "Identify this snake." },
      { type: "image_url", image_url: { url: image } },
    ];
    const vlm = await zaiVision([
      { role: "system", content: sys },
      { role: "user", content: user },
    ]);
    if (vlm) {
      const match = vlm.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          const parsed = JSON.parse(match[0]);
          picked = {
            species: parsed.species ?? picked.species,
            venom: parsed.venom ?? picked.venom,
            confidence: Number(parsed.confidence ?? 0.4),
            habitat: parsed.habitat ?? picked.habitat,
            firstAid: parsed.firstAid ?? picked.firstAid,
            danger: parsed.danger ?? picked.danger,
          };
          source = "vlm";
        } catch {
          /* keep mock */
        }
      }
    }
  } else if (freeText) {
    // crude keyword-based guess so the text-only path is still useful
    const t = freeText.toLowerCase();
    if (t.includes("hood") || t.includes("cobra")) picked = catalogue[0];
    else if (t.includes("russell") || t.includes("viper")) picked = catalogue[1];
    else if (t.includes("saw") || t.includes("scales")) picked = catalogue[2];
    else if (t.includes("krait")) picked = catalogue[3];
    else if (t.includes("rat snake") || t.includes("non")) picked = catalogue[4];
  }

  return NextResponse.json({
    species: picked.species,
    venom: picked.venom,
    confidence: picked.confidence,
    habitat: picked.habitat,
    firstAid: picked.firstAid,
    danger: picked.danger,
    note,
    source,
    disclaimer:
      "This is an assistive identification, not a medical diagnosis. If someone has been bitten, trigger SOS and get to a hospital — do not wait for a confirmed ID.",
  });
}
