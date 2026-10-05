import { describe, it, expect } from "vitest";
import {
  fromMemory,
  fromOpenFoodFacts,
  editName,
  applyImprovedName,
  nameSourceLabel,
  canSaveName,
} from "./scanned-product";

describe("fromMemory", () => {
  it("crée un produit issu de la mémoire, sans appel LLM en cours", () => {
    expect(fromMemory("123", "Lardons")).toEqual({
      barcode: "123",
      name: "Lardons",
      source: "memory",
      edited: false,
      improving: false,
    });
  });
});

describe("fromOpenFoodFacts", () => {
  it("garde le code-barres scanné et marque l'amélioration en cours", () => {
    expect(fromOpenFoodFacts("03017620422003", "Nutella 400g")).toEqual({
      barcode: "03017620422003",
      name: "Nutella 400g",
      source: "off",
      edited: false,
      improving: true,
    });
  });
});

describe("editName", () => {
  it("met à jour le nom et marque le produit comme édité", () => {
    const next = editName(fromMemory("123", "Lardons"), "Lardons fumés");
    expect(next).toMatchObject({ name: "Lardons fumés", edited: true });
  });

  it("ne fait rien sans produit", () => {
    expect(editName(null, "x")).toBeNull();
  });
});

describe("applyImprovedName", () => {
  it("applique le nom amélioré et passe la source à ai", () => {
    const next = applyImprovedName(fromOpenFoodFacts("123", "NUTELLA 400G"), "123", "Nutella");
    expect(next).toMatchObject({ name: "Nutella", source: "ai", improving: false });
  });

  it("conserve la saisie de l'utilisateur si elle précède la réponse du LLM", () => {
    const typed = editName(fromOpenFoodFacts("123", "NUTELLA 400G"), "Pâte à tartiner");
    const next = applyImprovedName(typed, "123", "Nutella");
    expect(next).toMatchObject({ name: "Pâte à tartiner", source: "off", improving: false });
  });

  it("ignore une réponse destinée à un autre code-barres", () => {
    const current = fromOpenFoodFacts("456", "Ketchup");
    expect(applyImprovedName(current, "123", "Nutella")).toBe(current);
  });

  it("termine l'amélioration sans changer le nom si le LLM échoue", () => {
    const next = applyImprovedName(fromOpenFoodFacts("123", "Nutella"), "123", null);
    expect(next).toMatchObject({ name: "Nutella", source: "off", improving: false });
  });

  it("ignore un nom amélioré vide", () => {
    const next = applyImprovedName(fromOpenFoodFacts("123", "Nutella"), "123", "   ");
    expect(next).toMatchObject({ name: "Nutella", source: "off", improving: false });
  });

  it("ne fait rien sans produit", () => {
    expect(applyImprovedName(null, "123", "Nutella")).toBeNull();
  });

  it("ignore une réponse tardive d'un scan précédent quand le nom vient de la mémoire", () => {
    const remembered = fromMemory("123", "Lait entier");
    expect(applyImprovedName(remembered, "123", "Lait UHT")).toBe(remembered);
  });
});

describe("nameSourceLabel", () => {
  it("affiche la source du nom", () => {
    expect(nameSourceLabel(fromMemory("1", "a"))).toBe("Nom mémorisé");
    expect(nameSourceLabel({ ...fromOpenFoodFacts("1", "a"), improving: false })).toBe("Open Food Facts");
    expect(nameSourceLabel(fromOpenFoodFacts("1", "a"))).toBe("Amélioration…");
    expect(nameSourceLabel(applyImprovedName(fromOpenFoodFacts("1", "a"), "1", "b")!)).toBe("Amélioré par IA");
  });
});

describe("canSaveName", () => {
  it("refuse un nom vide ou composé d'espaces", () => {
    expect(canSaveName(fromMemory("1", "   "))).toBe(false);
    expect(canSaveName(fromMemory("1", ""))).toBe(false);
  });

  it("accepte un nom non vide", () => {
    expect(canSaveName(fromMemory("1", " Lait "))).toBe(true);
  });
});
