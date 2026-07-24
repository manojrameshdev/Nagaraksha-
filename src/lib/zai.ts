import ZAI from "z-ai-web-dev-sdk";

let _zai: Awaited<ReturnType<typeof ZAI.create>> | null = null;

export async function getZAI() {
  if (!_zai) {
    _zai = await ZAI.create();
  }
  return _zai;
}

/** Best-effort chat completion. Returns null on failure so callers can fall back. */
export async function zaiChat(messages: { role: "system" | "user" | "assistant"; content: string }[]) {
  try {
    const zai = await getZAI();
    const res = await zai.chat.completions.create({
      messages,
      stream: false,
      thinking: { type: "disabled" },
    });
    const text =
      res?.choices?.[0]?.message?.content ??
      res?.choices?.[0]?.delta?.content ??
      (typeof res === "string" ? res : null);
    return typeof text === "string" ? text : JSON.stringify(text ?? "");
  } catch {
    return null;
  }
}

/** Best-effort vision (multimodal) completion. */
export async function zaiVision(
  messages: {
    role: "system" | "user" | "assistant";
    content: string | { type: "text" | "image_url"; text?: string; image_url?: { url: string } }[];
  }[]
) {
  try {
    const zai = await getZAI();
    const res = await zai.chat.completions.createVision({
      // @ts-expect-error model name accepted at runtime
      messages,
      stream: false,
    } as any);
    const text =
      res?.choices?.[0]?.message?.content ??
      res?.choices?.[0]?.delta?.content ??
      (typeof res === "string" ? res : null);
    return typeof text === "string" ? text : JSON.stringify(text ?? "");
  } catch {
    return null;
  }
}
