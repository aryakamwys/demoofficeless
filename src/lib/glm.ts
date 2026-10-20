/**
 * Klien GLM (Zhipu bigmodel, API kompatibel OpenAI) — SERVER-ONLY.
 * GLM_API_KEY tidak boleh sampai ke bundle browser.
 */

const BASE = process.env.GLM_BASE_URL || "https://open.bigmodel.cn/api/paas/v4";
const MODEL = process.env.GLM_MODEL || "glm-4.6";

export class GlmError extends Error {}

/** Chat completion yang diharapkan membalas JSON object. */
export async function glmJson(system: string, user: string): Promise<unknown> {
  const key = process.env.GLM_API_KEY;
  if (!key) throw new GlmError("GLM_API_KEY belum diset di environment server");

  let res: Response;
  try {
    res = await fetch(`${BASE}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        temperature: 0.2,
        response_format: { type: "json_object" },
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(60_000),
    });
  } catch {
    throw new GlmError("GLM API tidak terjangkau atau timeout (60s)");
  }

  if (!res.ok) {
    // Body respons tidak dibaca/di-log — bisa memuat konten email pelanggan
    throw new GlmError(`GLM API error: ${res.status} ${res.statusText}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new GlmError("GLM membalas tanpa konten");

  const cleaned = content
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    throw new GlmError("Output GLM bukan JSON valid");
  }
}
