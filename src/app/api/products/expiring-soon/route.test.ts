import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: { product: { findMany: vi.fn() } },
}));

import { GET } from "./route";
import { prisma } from "@/lib/prisma";

const findManyMock = prisma.product.findMany as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("GET /api/products/expiring-soon", () => {
  it("ne sélectionne que les produits expirant dans <= 3 jours", async () => {
    findManyMock.mockResolvedValue([{ id: "1", productName: "Yaourt" }]);
    const res = await GET();
    expect(res.status).toBe(200);

    const arg = findManyMock.mock.calls[0][0];
    expect(arg.where.expirationDate).toHaveProperty("lte");
    // borne haute = aujourd'hui + 3 jours
    const lte = new Date(arg.where.expirationDate.lte);
    const inThreeDays = new Date();
    inThreeDays.setDate(inThreeDays.getDate() + 3);
    expect(Math.abs(lte.getTime() - inThreeDays.getTime())).toBeLessThan(60_000);
  });

  it("retourne 500 en cas d'erreur DB", async () => {
    findManyMock.mockRejectedValue(new Error("db down"));
    const res = await GET();
    expect(res.status).toBe(500);
  });
});
