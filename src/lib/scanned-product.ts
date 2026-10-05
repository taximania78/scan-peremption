export type NameSource = "memory" | "off" | "ai";

export interface ScannedProduct {
  barcode: string;
  name: string;
  source: NameSource;
  edited: boolean;
  improving: boolean;
}

export function fromMemory(barcode: string, name: string): ScannedProduct {
  return { barcode, name, source: "memory", edited: false, improving: false };
}

// Le code scanné sert de clé à la mémoire : on ignore le `code` renvoyé par OFF,
// qui peut être normalisé différemment (zéros de tête…).
export function fromOpenFoodFacts(scannedBarcode: string, offName: string): ScannedProduct {
  return { barcode: scannedBarcode, name: offName, source: "off", edited: false, improving: true };
}

export function editName(prev: ScannedProduct | null, name: string): ScannedProduct | null {
  if (!prev) return prev;
  return { ...prev, name, edited: true };
}

export function applyImprovedName(
  prev: ScannedProduct | null,
  barcode: string,
  improvedName: string | null
): ScannedProduct | null {
  if (!prev || prev.barcode !== barcode) return prev;

  const done = { ...prev, improving: false };
  const trimmed = improvedName?.trim();
  if (prev.edited || !trimmed || trimmed === prev.name) return done;

  return { ...done, name: trimmed, source: "ai" };
}

export function nameSourceLabel(product: ScannedProduct): string {
  if (product.improving) return "Amélioration…";
  switch (product.source) {
    case "memory":
      return "Nom mémorisé";
    case "off":
      return "Open Food Facts";
    case "ai":
      return "Amélioré par IA";
  }
}

export function canSaveName(product: ScannedProduct): boolean {
  return product.name.trim().length > 0;
}
