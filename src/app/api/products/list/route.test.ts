import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: { product: { findMany: vi.fn() } },
}));

import { GET } from "./route";
import { prisma } from "@/lib/prisma";

const findManyMock = prisma.product.findMany as ReturnType<typeof vi.fn>;

beforeEach(() => vi.clearAllMocks());

describe("GET /api/products/list", () => {
  it("retourne la liste allégée triée par date de péremption", async () => {
    const rows = [{ id: "1", productName: "Lait", expirationDate: "2026-07-01" }];
    findManyMock.mockResolvedValue(rows);
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(rows);
    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { expirationDate: "asc" } })
    );
  });
});
