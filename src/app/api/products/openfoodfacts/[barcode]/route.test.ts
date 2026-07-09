import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GET } from "./route";

function call(barcode: string) {
  return GET(new Request("http://localhost/x") as never, {
    params: Promise.resolve({ barcode }),
  });
}

describe("GET /api/products/openfoodfacts/[barcode]", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("mappe le produit quand Open Food Facts répond status=success", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: "success",
        product: {
          product_name: "Nutella",
          product_name_fr: "Nutella",
          code: "3017620422003",
          image_front_url: "https://images.openfoodfacts.org/x.jpg",
        },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const res = await call("3017620422003");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      name: "Nutella",
      barcode: "3017620422003",
      image_url: "https://images.openfoodfacts.org/x.jpg",
    });

    // Conformité: v3 + User-Agent custom
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toContain("/api/v3/product/3017620422003");
    expect((opts as RequestInit).headers).toHaveProperty("User-Agent");
  });

  it("préfère product_name_fr puis retombe sur 'Nom inconnu'", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ status: "success", product: { code: "1" } }),
      })
    );
    const res = await call("1");
    expect((await res.json()).name).toBe("Nom inconnu");
  });

  it("retourne 404 quand status n'est pas success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ status: "failure", product: null }),
      })
    );
    const res = await call("0000000000000");
    expect(res.status).toBe(404);
  });

  it("propage le statut HTTP quand la réponse n'est pas ok", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 503, json: async () => ({}) })
    );
    const res = await call("123");
    expect(res.status).toBe(503);
  });

  it("retourne 500 si fetch échoue", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));
    const res = await call("123");
    expect(res.status).toBe(500);
  });

  it("encode le code-barres dans l'URL (anti path-injection)", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: "success", product: { code: "a/b" } }),
    });
    vi.stubGlobal("fetch", fetchMock);
    await call("a/b");
    expect(fetchMock.mock.calls[0][0]).toContain("a%2Fb");
  });
});
