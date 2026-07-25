// Curated, medically-reviewed snakebite knowledge base for NagRaksha RAG.
// Each entry is a chunk that the retriever can surface to the LLM.
// Sources basis: WHO SEARO snakebite management guidelines, NCBI snakebite
// envenoming reviews, and India's National Action Plan for Prevention &
// Control of Snakebite Envenoming (NAPSE). Reviewed by NagRaksha medical
// review (demo corpus).
export interface KBChunk {
  docId: string;
  title: string;
  category: "FIRST_AID" | "MYTH" | "SPECIES" | "RISK" | "ANTIVENOM" | "PROTOCOL";
  content: string;
  tags: string;
}

export const KNOWLEDGE_BASE: KBChunk[] = [
  // ---------------- FIRST AID ----------------
  {
    docId: "first-aid-immobilisation",
    title: "Immobilise the bitten limb — the foundation of first aid",
    category: "FIRST_AID",
    content:
      "Keep the bitten person as still and calm as possible. Immobilise the bitten limb with a splint or firm support at the level of the heart. Movement increases the rate at which venom spreads through the lymphatic system. Reassurance lowers heart rate and slows venom transport. This single step — stillness and immobilisation — is the only first-aid measure proven to improve outcomes before antivenom.",
    tags: "first aid, immobilise, splint, still, calm, lymphatic, limb, movement",
  },
  {
    docId: "first-aid-transport",
    title: "Transport to hospital without delay",
    category: "FIRST_AID",
    content:
      "Transport the victim to the nearest hospital with antivenom as quickly as possible. Do not wait for symptoms to worsen before leaving. If possible, carry the victim or use a vehicle; walking increases venom spread. Note the time of the bite and the time symptoms began, and tell the treating doctor.",
    tags: "transport, hospital, ambulance, carry, vehicle, delay, time of bite",
  },
  {
    docId: "first-aid-positioning",
    title: "Positioning and monitoring",
    category: "FIRST_AID",
    content:
      "Keep the bitten limb at roughly heart level if possible. Remove rings, watches, bangles and tight clothing near the bite in case of swelling. Lay the person on their side if they vomit or become drowsy. Watch breathing and consciousness continuously on the way to hospital; be ready to perform rescue breathing if needed.",
    tags: "positioning, heart level, swelling, rings, jewellery, consciousness, breathing, vomiting",
  },
  {
    docId: "first-aid-do-nots",
    title: "Do NOT do these things at a bite",
    category: "FIRST_AID",
    content:
      "Do not cut the wound, do not attempt to suck out venom, do not apply ice, do not give alcohol or stimulants, do not apply a tight tourniquet, and do not try to catch or kill the snake. These actions do not help and often cause serious harm — tissue damage, infection, delayed care, or amputation. The only proven pre-hospital measure is immobilisation and rapid transport.",
    tags: "dont, cut, suck, ice, tourniquet, alcohol, harm, amputation, infection",
  },

  // ---------------- MYTHS ----------------
  {
    docId: "myth-tourniquet",
    title: "Myth: a tight tourniquet stops venom spread",
    category: "MYTH",
    content:
      "MYTH: Tie a tight band or rope above the bite to trap the venom in the limb. FACT: Tight tourniquets cut off arterial flow, causing severe tissue damage, gangrene and unnecessary amputations. Lymphatic flow (the main route of venom spread) continues despite them. A broad, loose pressure immobilisation bandage can help only for neurotoxic elapid bites when used correctly, but a tight tourniquet must never be applied by untrained people. Immobilise the limb and reach a hospital instead.",
    tags: "tourniquet, tight band, myth, gangrene, amputation, pressure immobilisation, elapid, neurotoxic",
  },
  {
    docId: "myth-suck-cut",
    title: "Myth: cut the wound and suck out the venom",
    category: "MYTH",
    content:
      "MYTH: Cut across the bite marks and suck out the venom with the mouth. FACT: Cutting and sucking removes negligible venom and introduces infection from mouth bacteria and dirty blades. It deepens the wound, damages tissue, and delays real treatment. Snakebite venom enters the lymphatic and blood systems within minutes — it cannot be withdrawn at the skin. Do not cut, do not suck; immobilise and go to a hospital.",
    tags: "cut, suck, incision, mouth, infection, myth, venom removal, skin",
  },
  {
    docId: "myth-ice",
    title: "Myth: apply ice to the bite",
    category: "MYTH",
    content:
      "MYTH: Apply ice or a cold compress to slow venom at the bite site. FACT: Ice does not neutralise venom or slow its spread. It can damage skin and tissue through frostbite-like injury, and the cold delays proper care. Immobilise the limb with a splint and transport to hospital — ice is never recommended.",
    tags: "ice, cold, compress, frostbite, myth, skin damage, first aid",
  },
  {
    docId: "myth-healer",
    title: "Myth: a traditional healer can treat a snakebite",
    category: "MYTH",
    content:
      "MYTH: A traditional healer, mantra, herbal paste, or jhad-phoonk can cure snakebite. FACT: Time to hospital is the single biggest factor in survival. Healers are valued members of the community, but no chant, root, or paste has been shown to neutralise venom, and waiting for them wastes the critical first hour when antivenom works best. Go to a hospital first; cultural respect and medical care are not in conflict.",
    tags: "healer, traditional, mantra, herbal, jhad, phoonk, myth, delay, first hour, community",
  },
  {
    docId: "myth-photo-certainty",
    title: "Myth: a photo can guarantee the snake species",
    category: "MYTH",
    content:
      "MYTH: A smartphone photo can definitely identify the snake. FACT: Photo identification is assistive and often uncertain. Many species look similar, lighting and angle distort colour and pattern, and juvenile snakes differ from adults. A likely match is not a diagnosis. Even a high-confidence identification should not delay medical care — polyvalent antivenom in India covers the 'Big Four' and is given based on symptoms, not species certainty.",
    tags: "photo, identify, certainty, species, diagnosis, big four, polyvalent, uncertain",
  },
  {
    docId: "myth-urination-alcohol",
    title: "Myth: give alcohol or force urination",
    category: "MYTH",
    content:
      "MYTH: Give the victim alcohol or force them to urinate to flush out venom. FACT: Alcohol widens blood vessels and may increase venom spread, and intoxication confuses the clinical picture. Urination does not excrete venom. Give nothing by mouth except water if the person is fully conscious and not vomiting, and prioritise reaching a hospital.",
    tags: "alcohol, urine, flush, myth, blood vessels, intoxication, oral",
  },

  // ---------------- SPECIES ----------------
  {
    docId: "species-cobra",
    title: "Indian Cobra (Naja naja) — neurotoxic",
    category: "SPECIES",
    content:
      "The Indian cobra is one of the 'Big Four' medically important snakes. It delivers a neurotoxic venom. Signs include drooping eyelids (ptosis), blurred vision, difficulty speaking and swallowing, and progressive muscle weakness. A hood may be visible but identification from a photo is unreliable. First aid: immobilise the limb, keep the person still, and transport to a hospital with polyvalent antivenom.",
    tags: "cobra, naja, big four, neurotoxic, ptosis, weakness, hood, polyvalent",
  },
  {
    docId: "species-russell",
    title: "Russell's Viper (Daboia russelii) — haemotoxic",
    category: "SPECIES",
    content:
      "Russell's viper is a 'Big Four' snake delivering haemotoxic venom. Bites cause severe local pain and swelling, bleeding from gums and bite site, low urine output (kidney injury), and in severe cases shock. This snake is a leading cause of snakebite death in India. First aid: immobilise, do not apply tourniquet, and transport urgently to a hospital that can give antivenom and manage bleeding and kidney failure.",
    tags: "russell, viper, big four, haemotoxic, bleeding, kidney, swelling, pain, antivenom",
  },
  {
    docId: "species-sawscaled",
    title: "Saw-scaled Viper (Echis carinatus) — haemotoxic",
    category: "SPECIES",
    content:
      "The saw-scaled viper is small but a 'Big Four' snake with potent haemotoxic venom. It rubs its scales to make a warning rasp. Bites cause local swelling, bleeding, low platelet count, and can be life-threatening despite the snake's size. Found in dry scrub and sandy soil. Immobilise and transport to hospital; antivenom is the definitive treatment.",
    tags: "saw-scaled, echis, small, big four, haemotoxic, bleeding, platelets, rasp, scrub, dry",
  },
  {
    docId: "species-krait",
    title: "Common Krait (Bungarus caeruleus) — neurotoxic, painless bite",
    category: "SPECIES",
    content:
      "The common krait is a 'Big Four' nocturnal snake. Its bite is often painless — people sleep through it — but envenoming is severe and life-threatening. Signs develop hours later: abdominal pain, progressive muscle paralysis, drooping eyelids, and respiratory failure. Krait bites require urgent hospital care and antivenom; the bite being painless must never be taken as 'no envenomation'.",
    tags: "krait, bungarus, nocturnal, painless bite, paralysis, respiratory, big four, neurotoxic",
  },
  {
    docId: "species-ratsnake",
    title: "Oriental Rat Snake (Ptyas mucosa) — non-venomous",
    category: "SPECIES",
    content:
      "The oriental rat snake is large, fast-moving and non-venomous. It is commonly encountered near fields, granaries and water. A defensive bite should still be cleaned with soap and water and reviewed for tetanus risk, but no antivenom is required. Misidentifying a venomous snake as a rat snake is dangerous — if there is any doubt, treat the bite as potentially venomous and seek medical care.",
    tags: "rat snake, ptyas, non-venomous, harmless, fields, granary, tetanus, misidentification",
  },

  // ---------------- ANTIVENOM ----------------
  {
    docId: "antivenom-polyvalent",
    title: "Polyvalent ASV and the Big Four",
    category: "ANTIVENOM",
    content:
      "In India, polyvalent anti-snake venom (ASV) is manufactured against the 'Big Four' — cobra, Russell's viper, saw-scaled viper, and common krait. It is effective against envenoming from these species and is given in hospital based on clinical signs and lab tests. ASV dosage is decided by a doctor and is not a pre-hospital treatment. NagRaksha routes victims to hospitals that have confirmed ASV stock.",
    tags: "antivenom, ASV, polyvalent, big four, hospital, dosage, doctor, stock",
  },
  {
    docId: "antivenom-administration",
    title: "ASV is a hospital-only treatment",
    category: "ANTIVENOM",
    content:
      "Antivenom is derived from horse or sheep serum and can cause allergic reactions, including anaphylaxis. It must be given in a hospital where reactions can be managed. It is never appropriate for a first responder or bystander to administer ASV in the field. The correct pre-hospital action is immobilisation and rapid transport to a hospital with confirmed stock.",
    tags: "antivenom, ASV, anaphylaxis, allergy, hospital, serum, field, administer",
  },
  {
    docId: "antivenom-stock-freshness",
    title: "Why stock freshness matters for routing",
    category: "ANTIVENOM",
    content:
      "A hospital reporting antivenom stock does not guarantee a victim will be treated — stock must be confirmed, current, and sufficient. NagRaksha ranks hospitals by confirmed stock first, then travel time. Stale or unknown stock is penalised because a victim routed to an empty hospital loses the critical first hour. Hospitals update their console in real time, and that freshness feeds directly into routing decisions.",
    tags: "stock, confirmed, fresh, stale, unknown, routing, ranking, freshness, real time",
  },

  // ---------------- RISK ----------------
  {
    docId: "risk-monsoon",
    title: "Monsoon elevates encounter risk",
    category: "RISK",
    content:
      "Snake encounters rise sharply during and after the monsoon. Heavy rain floods burrows, forcing snakes into fields, homes and storage areas. Post-rain nights with high humidity are peak activity times for the Big Four. People working in fields, especially at dawn and dusk, should wear closed footwear, use a torch after dark, and keep children away from vegetation edges. NagRaksha pushes a risk advisory when conditions are elevated.",
    tags: "monsoon, rain, humidity, fields, night, dawn, dusk, footwear, torch, risk advisory",
  },
  {
    docId: "risk-fields",
    title: "Agricultural and outdoor field risk",
    category: "RISK",
    content:
      "Farmers, agricultural workers and people walking through tall grass or near rodent burrows face the highest encounter risk. Rodents attract snakes, especially vipers and kraits. Use a stick to probe ahead, avoid dry woodpiles and termite mounds, and never put hands or feet where you cannot see. Carry a charged phone with NagRaksha SOS ready when entering the field.",
    tags: "agriculture, farmer, tall grass, rodent, stick, woodpile, termite mound, phone, SOS",
  },

  // ---------------- PROTOCOL ----------------
  {
    docId: "protocol-sos",
    title: "What happens when you trigger an SOS",
    category: "PROTOCOL",
    content:
      "When an SOS is triggered, NagRaksha creates an incident and simultaneously notifies three responder categories in parallel: a trained village-level first responder, a snake rescue team, and an ambulance routed to the nearest hospital with confirmed antivenom. There is no queueing between them. Responders accept and the victim sees live ETAs. The trained responder logs structured symptoms that are handed to the treating doctor before arrival.",
    tags: "SOS, parallel, dispatch, trained, rescue, ambulance, ETA, symptom log, handoff",
  },
  {
    docId: "protocol-handoff",
    title: "Pre-arrival symptom handoff to the doctor",
    category: "PROTOCOL",
    content:
      "The trained first responder records structured observations — local pain, swelling extent, bleeding, drooping eyelids, breathing — with timestamps. This symptom timeline is transmitted to the receiving hospital before the victim arrives, so the doctor can prepare antivenom and manage the case. Handing species suspicion (not certainty) alongside symptoms supports, but never replaces, the doctor's clinical judgement.",
    tags: "handoff, symptoms, timeline, doctor, hospital, antivenom, preparation, species, clinical",
  },
];
