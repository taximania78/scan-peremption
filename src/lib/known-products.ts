import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

// Ajouts manuels sans vrai code-barres : jamais rescannés, inutile de les mémoriser.
const MANUAL_BARCODE_PREFIX = "MANUAL-";

export async function findKnownName(barcode: string): Promise<string | null> {
  const known = await prisma.knownProduct.findUnique({ where: { barcode } });
  return known?.name ?? null;
}

export async function rememberName(
  tx: Prisma.TransactionClient,
  barcode: string,
  name: string
): Promise<void> {
  const trimmed = name.trim();
  if (!barcode || barcode.startsWith(MANUAL_BARCODE_PREFIX) || !trimmed) return;

  await tx.knownProduct.upsert({
    where: { barcode },
    create: { barcode, name: trimmed },
    update: { name: trimmed },
  });
}
