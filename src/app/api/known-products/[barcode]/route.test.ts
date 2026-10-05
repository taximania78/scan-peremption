import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    knownProduct: {
      findUnique: vi.fn(),
    },
  },
}));

import { GET } from "./route";
import { prisma } from "@/lib/prisma";

const findUniqueMock = prisma.knownProduct.findUnique as ReturnType<typeof vi.fn>;

function call(barcode: string) {
  return GET(new Request("http://localhost/x") as never, {
    params: Promise.resolve({ barcode }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("GET /api/known-products/[barcode]", () => {
  it("retourne 200 et le nom quand le code-barres est connu", async () => {
    findUniqueMock.mockResolvedValue({ barcode: "123", name: "Lardons" });
    const res = await call("123");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ name: "Lardons" });
  });

  it("retourne 404 quand le code-barres est inconnu", async () => {
    findUniqueMock.mockResolvedValue(null);
    const res = await call("999");
    expect(res.status).toBe(404);
  });

  it("retourne 500 quand la base échoue", async () => {
    findUniqueMock.mockRejectedValue(new Error("db down"));
    const res = await call("123");
    expect(res.status).toBe(500);
  });
});
