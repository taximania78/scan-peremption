import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    product: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

import { POST, GET } from "./route";
import { prisma } from "@/lib/prisma";

const createMock = prisma.product.create as ReturnType<typeof vi.fn>;
const findManyMock = prisma.product.findMany as ReturnType<typeof vi.fn>;

function post(body: unknown) {
  return POST(
    new Request("http://localhost/api/products", {
      method: "POST",
      body: JSON.stringify(body),
    }) as never
  );
}

describe("POST /api/products", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("retourne 400 si un champ requis manque", async () => {
    const res = await post({ barcode: "1", productName: "Lait" }); // pas de date
    expect(res.status).toBe(400);
    expect(createMock).not.toHaveBeenCalled();
  });

  it("crée le produit et retourne 201", async () => {
    const created = { id: "uuid", barcode: "1", productName: "Lait" };
    createMock.mockResolvedValue(created);
    const res = await post({
      barcode: "1",
      productName: "Lait",
      expirationDate: "2026-07-01",
    });
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual(created);
    expect(createMock).toHaveBeenCalledOnce();
  });

  it("retourne 409 sur violation d'unicité Prisma (P2002)", async () => {
    createMock.mockRejectedValue({ code: "P2002" });
    const res = await post({
      barcode: "1",
      productName: "Lait",
      expirationDate: "2026-07-01",
    });
    expect(res.status).toBe(409);
  });

  it("retourne 500 sur erreur inattendue", async () => {
    createMock.mockRejectedValue(new Error("boom"));
    const res = await post({
      barcode: "1",
      productName: "Lait",
      expirationDate: "2026-07-01",
    });
    expect(res.status).toBe(500);
  });
});

describe("GET /api/products", () => {
  beforeEach(() => vi.clearAllMocks());

  it("retourne la liste des produits", async () => {
    const products = [{ id: "1" }, { id: "2" }];
    findManyMock.mockResolvedValue(products);
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(products);
  });
});
