import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => {
  const prisma = {
    product: {
      delete: vi.fn(),
      update: vi.fn(),
    },
    knownProduct: {
      upsert: vi.fn(),
    },
    $transaction: vi.fn((fn: (tx: unknown) => unknown) => fn(prisma)),
  };
  return { prisma };
});

import { DELETE, PATCH } from "./route";
import { prisma } from "@/lib/prisma";

const deleteMock = prisma.product.delete as ReturnType<typeof vi.fn>;
const updateMock = prisma.product.update as ReturnType<typeof vi.fn>;
const upsertMock = prisma.knownProduct.upsert as ReturnType<typeof vi.fn>;

function patch(id: string, body: unknown) {
  return PATCH(
    new Request("http://localhost/x", {
      method: "PATCH",
      body: JSON.stringify(body),
    }) as never,
    { params: Promise.resolve({ id }) }
  );
}

function del(id: string) {
  return DELETE(new Request("http://localhost/x") as never, {
    params: Promise.resolve({ id }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("DELETE /api/products/[id]", () => {
  it("supprime et retourne le produit", async () => {
    deleteMock.mockResolvedValue({ id: "1" });
    const res = await del("1");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: "1" });
  });

  it("retourne 404 quand le produit n'existe pas (P2025)", async () => {
    deleteMock.mockRejectedValue({ code: "P2025" });
    const res = await del("404");
    expect(res.status).toBe(404);
  });
});

describe("PATCH /api/products/[id]", () => {
  it("retourne 400 quand aucun champ n'est fourni", async () => {
    const res = await patch("1", {});
    expect(res.status).toBe(400);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("met à jour et retourne le produit", async () => {
    updateMock.mockResolvedValue({ id: "1", productName: "Lait demi-écrémé" });
    const res = await patch("1", { productName: "Lait demi-écrémé" });
    expect(res.status).toBe(200);
    expect((await res.json()).productName).toBe("Lait demi-écrémé");
  });

  it("retourne 404 quand le produit n'existe pas (P2025)", async () => {
    updateMock.mockRejectedValue({ code: "P2025" });
    const res = await patch("404", { productName: "x" });
    expect(res.status).toBe(404);
  });

  it("mémorise le nouveau nom pour le code-barres du produit", async () => {
    updateMock.mockResolvedValue({ id: "1", barcode: "123", productName: "Lait demi-écrémé" });
    await patch("1", { productName: "Lait demi-écrémé" });
    expect(upsertMock).toHaveBeenCalledWith({
      where: { barcode: "123" },
      create: { barcode: "123", name: "Lait demi-écrémé" },
      update: { name: "Lait demi-écrémé" },
    });
  });

  it("ne touche pas la mémoire quand seule la date change", async () => {
    updateMock.mockResolvedValue({ id: "1", barcode: "123", productName: "Lait" });
    const res = await patch("1", { expirationDate: "2026-08-01" });
    expect(res.status).toBe(200);
    expect(upsertMock).not.toHaveBeenCalled();
  });
});
