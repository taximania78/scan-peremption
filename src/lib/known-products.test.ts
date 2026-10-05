import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    knownProduct: {
      findUnique: vi.fn(),
    },
  },
}));

import { findKnownName, rememberName } from "./known-products";
import { prisma } from "@/lib/prisma";

const findUniqueMock = prisma.knownProduct.findUnique as ReturnType<typeof vi.fn>;
const upsertMock = vi.fn();
const tx = { knownProduct: { upsert: upsertMock } } as never;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("findKnownName", () => {
  it("retourne le nom mémorisé", async () => {
    findUniqueMock.mockResolvedValue({ barcode: "123", name: "Lardons" });
    expect(await findKnownName("123")).toBe("Lardons");
    expect(findUniqueMock).toHaveBeenCalledWith({ where: { barcode: "123" } });
  });

  it("retourne null quand le code-barres est inconnu", async () => {
    findUniqueMock.mockResolvedValue(null);
    expect(await findKnownName("999")).toBeNull();
  });
});

describe("rememberName", () => {
  it("upsert le nom trimé", async () => {
    await rememberName(tx, "123", "  Lardons fumés  ");
    expect(upsertMock).toHaveBeenCalledWith({
      where: { barcode: "123" },
      create: { barcode: "123", name: "Lardons fumés" },
      update: { name: "Lardons fumés" },
    });
  });

  it("ignore les codes-barres MANUAL-*", async () => {
    await rememberName(tx, "MANUAL-1730000000000", "Soupe maison");
    expect(upsertMock).not.toHaveBeenCalled();
  });

  it("ignore un nom vide ou composé d'espaces", async () => {
    await rememberName(tx, "123", "   ");
    expect(upsertMock).not.toHaveBeenCalled();
  });

  it("ignore un code-barres vide", async () => {
    await rememberName(tx, "", "Lardons");
    expect(upsertMock).not.toHaveBeenCalled();
  });
});
