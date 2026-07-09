import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { POST } from "./route";

function post(body: unknown) {
  return POST(
    new Request("http://localhost/api/ai/improve-product-name", {
      method: "POST",
      body: JSON.stringify(body),
    })
  );
}

describe("POST /api/ai/improve-product-name", () => {
  const originalKey = process.env.OPENROUTER_API_KEY;

  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    if (originalKey === undefined) delete process.env.OPENROUTER_API_KEY;
    else process.env.OPENROUTER_API_KEY = originalKey;
  });

  it("retourne 400 si productName manque", async () => {
    const res = await post({});
    expect(res.status).toBe(400);
  });

  it("retourne le nom inchangé quand la clé API est absente (dégradation gracieuse)", async () => {
    delete process.env.OPENROUTER_API_KEY;
    const res = await post({ productName: "LARDONS 500G" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ improvedName: "LARDONS 500G" });
  });

  it("retourne le nom reformulé par le modèle quand la clé est présente", async () => {
    process.env.OPENROUTER_API_KEY = "sk-or-test";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ choices: [{ message: { content: "Lardons" } }] }),
      })
    );
    const res = await post({ productName: "LARDONS 500G" });
    expect(await res.json()).toEqual({ improvedName: "Lardons" });
  });

  it("retombe sur le nom d'origine si l'API renvoie une erreur", async () => {
    process.env.OPENROUTER_API_KEY = "sk-or-test";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, text: async () => "boom" })
    );
    const res = await post({ productName: "LARDONS 500G" });
    expect(await res.json()).toEqual({ improvedName: "LARDONS 500G" });
  });
});
