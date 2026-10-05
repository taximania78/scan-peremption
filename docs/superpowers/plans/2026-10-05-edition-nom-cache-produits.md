# Édition du nom au scan et mémoire des noms produits — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** rendre le nom modifiable sur l'écran post-scan et mémoriser le nom validé par code-barres pour éviter de rappeler Open Food Facts (OFF) et le LLM aux scans suivants.

**Architecture :** nouvelle table Prisma `KnownProduct` (SQLite existante) exposée par `GET /api/known-products/[barcode]` ; la mémorisation se fait côté serveur, dans la même transaction que `POST /api/products` et `PATCH /api/products/[id]`. Le client consulte la mémoire d'abord, puis retombe sur le flux OFF → LLM existant ; la logique d'état du produit scanné est extraite en fonctions pures testées.

**Tech Stack :** Next.js 16 (App Router), React 19, Prisma 7 (`prisma-client` generator, adapter better-sqlite3), Vitest, Tailwind 4.

**Spec :** `docs/superpowers/specs/2026-10-05-edition-nom-cache-produits-design.md`

## Global Constraints

- Les codes-barres commençant par `MANUAL-` ne sont jamais mémorisés.
- Un nom vide après `trim()` n'est jamais mémorisé ; le nom mémorisé est stocké trimé.
- La mémoire est indexée par le code-barres **scanné** (pas par celui renvoyé par OFF).
- Aucune relation Prisma entre `KnownProduct` et `Product`.
- Pas d'image produit : `image_url`/`image_front_url` disparaissent, ainsi que `images.remotePatterns` dans `next.config.ts`.
- Textes UI en français ; libellés de source exacts : « Nom mémorisé », « Open Food Facts », « Amélioration… », « Amélioré par IA » ; bouton « ↻ Relancer ».
- Tests : Vitest, Prisma mocké via `vi.mock("@/lib/prisma", …)` comme les tests existants ; noms de tests en français.
- Commits : messages conventionnels (`feat:`, `test:`, `refactor:`), terminés par `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.

## Review Focus

1. **L'utilisateur tape dans le champ pendant que le LLM répond** → sa saisie est conservée, la réponse LLM ignorée (test `applyImprovedName` — Task 4).
2. **Nouveau scan d'un autre article pendant qu'un appel LLM précédent est en vol** → l'ancien nom amélioré n'écrase pas le nouveau produit (test garde code-barres — Task 4).
3. **Nom avec espaces autour / uniquement des espaces** → mémorisé trimé, jamais mémorisé s'il est vide ; bouton de validation désactivé (tests `rememberName` — Task 1, `canSaveName` — Task 4).
4. **OFF renvoie un `code` différent du code scanné** (zéros de tête, normalisation EAN) → le produit et la mémoire utilisent le code scanné, sinon le rescan ne trouverait jamais la mémoire (test `fromOpenFoodFacts` — Task 4).
5. **Renommage via la modale où seule la date change** → la mémoire n'est pas touchée ; un renommage met la mémoire à jour (tests PATCH — Task 3).

---

## Fichiers

| Fichier | Rôle |
|---|---|
| `prisma/schema.prisma` (modif) | modèle `KnownProduct` |
| `prisma/migrations/<ts>_add_known_product/migration.sql` (créé) | création de la table |
| `src/lib/known-products.ts` (créé) | `findKnownName`, `rememberName` |
| `src/lib/known-products.test.ts` (créé) | tests unitaires |
| `src/app/api/known-products/[barcode]/route.ts` (+ `.test.ts`) (créés) | lecture de la mémoire |
| `src/app/api/products/route.ts` (+ test) (modif) | POST transactionnel + mémorisation |
| `src/app/api/products/[id]/route.ts` (+ test) (modif) | PATCH transactionnel + mémorisation |
| `src/lib/scanned-product.ts` (+ `.test.ts`) (créés) | état pur du produit scanné (source, édition, garde LLM) |
| `src/app/api/products/openfoodfacts/[barcode]/route.ts` (+ test) (modif) | retrait de l'image |
| `src/app/page.tsx` (modif) | flux de scan, champ éditable, bouton Relancer |
| `next.config.ts` (modif) | retrait de `images.remotePatterns` |

---

### Task 0 : Préparation

- [ ] **Step 1 : Installer les dépendances à jour du lockfile**

Les `node_modules` locaux peuvent être en retard sur `package.json` (Prisma 7.8 installé vs `^7.10` déclaré).

Run : `npm ci && npx prisma generate`
Expected : succès, `src/generated/prisma/client.ts` régénéré.

- [ ] **Step 2 : Vérifier la base de tests**

Run : `npm test`
Expected : tous les tests existants PASS.

---

### Task 1 : Modèle `KnownProduct` et module `known-products`

**Files :**
- Modify : `prisma/schema.prisma`
- Create : `prisma/migrations/<timestamp>_add_known_product/migration.sql` (généré)
- Create : `src/lib/known-products.ts`
- Test : `src/lib/known-products.test.ts`

**Interfaces :**
- Consumes : `prisma` de `@/lib/prisma` ; type `Prisma.TransactionClient` de `@/generated/prisma/client`.
- Produces :
  - `findKnownName(barcode: string): Promise<string | null>`
  - `rememberName(tx: Prisma.TransactionClient, barcode: string, name: string): Promise<void>`
  - délégué Prisma `knownProduct` (`findUnique`, `upsert`).

- [ ] **Step 1 : Ajouter le modèle au schéma**

À la fin de `prisma/schema.prisma` :

```prisma
model KnownProduct {
  barcode   String   @id
  name      String
  updatedAt DateTime @updatedAt
}
```

- [ ] **Step 2 : Générer la migration sur une base jetable**

On évite de toucher la base de dev locale : la migration est générée contre une base vide temporaire.

Run :
```bash
DATABASE_URL="file:$TMPDIR/known-product-migration.db" npx prisma migrate dev --name add_known_product
npx prisma generate
rm -f "$TMPDIR/known-product-migration.db"
```
Expected : nouveau dossier `prisma/migrations/<timestamp>_add_known_product/` contenant exactement :

```sql
-- CreateTable
CREATE TABLE "KnownProduct" (
    "barcode" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL
);
```

Si le SQL généré diffère (autre table modifiée, index…), s'arrêter et le signaler.

- [ ] **Step 3 : Écrire les tests qui échouent**

`src/lib/known-products.test.ts` :

```ts
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
```

- [ ] **Step 4 : Vérifier l'échec**

Run : `npx vitest run src/lib/known-products.test.ts`
Expected : FAIL — `Failed to resolve import "./known-products"`.

- [ ] **Step 5 : Implémenter**

`src/lib/known-products.ts` :

```ts
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
```

- [ ] **Step 6 : Vérifier le succès + types**

Run : `npx vitest run src/lib/known-products.test.ts && npx tsc --noEmit`
Expected : 6 tests PASS, aucune erreur TypeScript.

- [ ] **Step 7 : Commit**

```bash
git add prisma/schema.prisma prisma/migrations src/lib/known-products.ts src/lib/known-products.test.ts
git commit -m "feat: table KnownProduct et module de mémoire des noms

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2 : Route `GET /api/known-products/[barcode]`

**Files :**
- Create : `src/app/api/known-products/[barcode]/route.ts`
- Test : `src/app/api/known-products/[barcode]/route.test.ts`

**Interfaces :**
- Consumes : `findKnownName(barcode: string): Promise<string | null>` (Task 1).
- Produces : `GET /api/known-products/{barcode}` → `200 { name: string }` | `404 { error: string }` | `500 { error: string }`.

- [ ] **Step 1 : Écrire les tests qui échouent**

`src/app/api/known-products/[barcode]/route.test.ts` :

```ts
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
```

- [ ] **Step 2 : Vérifier l'échec**

Run : `npx vitest run "src/app/api/known-products"`
Expected : FAIL — `Failed to resolve import "./route"`.

- [ ] **Step 3 : Implémenter**

`src/app/api/known-products/[barcode]/route.ts` :

```ts
import { NextRequest, NextResponse } from "next/server";
import { findKnownName } from "@/lib/known-products";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ barcode: string }> }
) {
  const { barcode } = await params;

  try {
    const name = await findKnownName(barcode);

    if (name === null) {
      return NextResponse.json(
        { error: "Produit inconnu" },
        { status: 404 }
      );
    }

    return NextResponse.json({ name });
  } catch (error) {
    console.error("Error reading known product:", error);
    return NextResponse.json(
      { error: "Erreur lors de la lecture des noms mémorisés" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 4 : Vérifier le succès**

Run : `npx vitest run "src/app/api/known-products"`
Expected : 3 tests PASS.

- [ ] **Step 5 : Commit**

```bash
git add src/app/api/known-products
git commit -m "feat: route de lecture des noms mémorisés

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3 : Mémorisation dans `POST /api/products` et `PATCH /api/products/[id]`

**Files :**
- Modify : `src/app/api/products/route.ts` (fonction `POST`)
- Modify : `src/app/api/products/route.test.ts`
- Modify : `src/app/api/products/[id]/route.ts` (fonction `PATCH`)
- Modify : `src/app/api/products/[id]/route.test.ts`

**Interfaces :**
- Consumes : `rememberName(tx, barcode, name)` (Task 1) ; `prisma.$transaction(async (tx) => …)`.
- Produces : comportement HTTP inchangé (mêmes statuts et corps) ; effet de bord : upsert `KnownProduct`.

Le mock Prisma devient « transactionnel » : `$transaction` appelle la fonction reçue avec le mock lui-même comme `tx`, donc les mocks existants (`product.create`, `product.update`) restent valables.

- [ ] **Step 1 : Adapter le mock et ajouter les tests POST**

Dans `src/app/api/products/route.test.ts`, remplacer le bloc `vi.mock(...)` et les déclarations de mocks par :

```ts
vi.mock("@/lib/prisma", () => {
  const prisma = {
    product: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    knownProduct: {
      upsert: vi.fn(),
    },
    $transaction: vi.fn((fn: (tx: unknown) => unknown) => fn(prisma)),
  };
  return { prisma };
});

import { POST, GET } from "./route";
import { prisma } from "@/lib/prisma";

const createMock = prisma.product.create as ReturnType<typeof vi.fn>;
const findManyMock = prisma.product.findMany as ReturnType<typeof vi.fn>;
const upsertMock = prisma.knownProduct.upsert as ReturnType<typeof vi.fn>;
```

Puis ajouter dans `describe("POST /api/products", …)` :

```ts
  it("mémorise le nom du code-barres", async () => {
    createMock.mockResolvedValue({ id: "uuid", barcode: "1", productName: "Lait" });
    await post({ barcode: "1", productName: "Lait", expirationDate: "2026-07-01" });
    expect(upsertMock).toHaveBeenCalledWith({
      where: { barcode: "1" },
      create: { barcode: "1", name: "Lait" },
      update: { name: "Lait" },
    });
  });

  it("ne mémorise pas un ajout manuel sans code-barres", async () => {
    createMock.mockResolvedValue({ id: "uuid" });
    await post({
      barcode: "MANUAL-1730000000000",
      productName: "Soupe maison",
      expirationDate: "2026-07-01",
    });
    expect(upsertMock).not.toHaveBeenCalled();
  });

  it("retourne 500 si la mémorisation échoue", async () => {
    createMock.mockResolvedValue({ id: "uuid" });
    upsertMock.mockRejectedValueOnce(new Error("boom"));
    const res = await post({
      barcode: "1",
      productName: "Lait",
      expirationDate: "2026-07-01",
    });
    expect(res.status).toBe(500);
  });
```

- [ ] **Step 2 : Vérifier l'échec**

Run : `npx vitest run src/app/api/products/route.test.ts`
Expected : FAIL sur « mémorise le nom du code-barres » et « retourne 500 si la mémorisation échoue » (upsert jamais appelé).

- [ ] **Step 3 : Implémenter le POST transactionnel**

Dans `src/app/api/products/route.ts`, ajouter l'import :

```ts
import { rememberName } from "@/lib/known-products";
```

et remplacer le bloc `const product = await prisma.product.create({ … });` par :

```ts
    const product = await prisma.$transaction(async (tx) => {
      const created = await tx.product.create({
        data: {
          barcode,
          productName,
          expirationDate: new Date(expirationDate),
        },
      });
      await rememberName(tx, barcode, productName);
      return created;
    });
```

- [ ] **Step 4 : Vérifier le succès**

Run : `npx vitest run src/app/api/products/route.test.ts`
Expected : tous PASS (y compris 409 `P2002` et 500 existants).

- [ ] **Step 5 : Adapter le mock et ajouter les tests PATCH**

Dans `src/app/api/products/[id]/route.test.ts`, remplacer le bloc `vi.mock(...)` et les déclarations de mocks par :

```ts
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
```

Puis ajouter dans `describe("PATCH /api/products/[id]", …)` :

```ts
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
```

- [ ] **Step 6 : Vérifier l'échec**

Run : `npx vitest run "src/app/api/products/[id]/route.test.ts"`
Expected : FAIL sur « mémorise le nouveau nom… ».

- [ ] **Step 7 : Implémenter le PATCH transactionnel**

Dans `src/app/api/products/[id]/route.ts`, ajouter l'import :

```ts
import { rememberName } from "@/lib/known-products";
```

et, dans `PATCH`, remplacer le bloc `const product = await prisma.product.update({ … });` par :

```ts
    const product = await prisma.$transaction(async (tx) => {
      const updated = await tx.product.update({
        where: { id },
        data: {
          productName,
          expirationDate: expirationDate ? new Date(expirationDate) : undefined,
        },
      });
      if (typeof productName === "string") {
        await rememberName(tx, updated.barcode, productName);
      }
      return updated;
    });
```

- [ ] **Step 8 : Vérifier le succès + types**

Run : `npm test && npx tsc --noEmit`
Expected : tous les tests PASS (dont le 404 `P2025` existant), aucune erreur TypeScript.

- [ ] **Step 9 : Commit**

```bash
git add src/app/api/products/route.ts src/app/api/products/route.test.ts "src/app/api/products/[id]"
git commit -m "feat: mémoriser le nom à l'ajout et au renommage d'un produit

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4 : État pur du produit scanné (`scanned-product`)

**Files :**
- Create : `src/lib/scanned-product.ts`
- Test : `src/lib/scanned-product.test.ts`

**Interfaces :**
- Produces (utilisé par Task 5) :

```ts
export type NameSource = "memory" | "off" | "ai";
export interface ScannedProduct {
  barcode: string;
  name: string;
  source: NameSource;
  edited: boolean;    // l'utilisateur a tapé dans le champ
  improving: boolean; // appel LLM en cours
}
export function fromMemory(barcode: string, name: string): ScannedProduct;
export function fromOpenFoodFacts(scannedBarcode: string, offName: string): ScannedProduct;
export function editName(prev: ScannedProduct | null, name: string): ScannedProduct | null;
export function applyImprovedName(prev: ScannedProduct | null, barcode: string, improvedName: string | null): ScannedProduct | null;
export function nameSourceLabel(product: ScannedProduct): string;
export function canSaveName(product: ScannedProduct): boolean;
```

- [ ] **Step 1 : Écrire les tests qui échouent**

`src/lib/scanned-product.test.ts` :

```ts
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
```

- [ ] **Step 2 : Vérifier l'échec**

Run : `npx vitest run src/lib/scanned-product.test.ts`
Expected : FAIL — `Failed to resolve import "./scanned-product"`.

- [ ] **Step 3 : Implémenter**

`src/lib/scanned-product.ts` :

```ts
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
```

- [ ] **Step 4 : Vérifier le succès**

Run : `npx vitest run src/lib/scanned-product.test.ts && npx tsc --noEmit`
Expected : tous PASS, aucune erreur TypeScript.

- [ ] **Step 5 : Commit**

```bash
git add src/lib/scanned-product.ts src/lib/scanned-product.test.ts
git commit -m "feat: état pur du produit scanné (source, édition, garde LLM)

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5 : Écran de scan — mémoire, champ éditable, Relancer, retrait de l'image

**Files :**
- Modify : `src/app/api/products/openfoodfacts/[barcode]/route.ts`
- Modify : `src/app/api/products/openfoodfacts/[barcode]/route.test.ts`
- Modify : `next.config.ts`
- Modify : `src/app/page.tsx` (import l.4, interface `OpenFoodProduct` l.38-42, état l.44, `handleScan`/`improveProductName`/`handleSaveProduct` l.77-171, carte produit l.423-448, boutons l.463-482)

**Interfaces :**
- Consumes : `GET /api/known-products/{barcode}` (Task 2) ; `ScannedProduct`, `fromMemory`, `fromOpenFoodFacts`, `editName`, `applyImprovedName`, `nameSourceLabel`, `canSaveName` (Task 4) ; `POST /api/products` (Task 3, mémorise côté serveur).
- Produces : `GET /api/products/openfoodfacts/{barcode}` → `200 { name: string, barcode: string }` (plus d'`image_url`).

- [ ] **Step 1 : Mettre à jour le test OFF (échec attendu)**

Dans `src/app/api/products/openfoodfacts/[barcode]/route.test.ts`, test « mappe le produit… », remplacer l'assertion `toEqual` et ajouter une vérification de l'URL :

```ts
    expect(await res.json()).toEqual({
      name: "Nutella",
      barcode: "3017620422003",
    });

    // Conformité: v3 + User-Agent custom
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toContain("/api/v3/product/3017620422003");
    expect(url).not.toContain("image_front_url");
    expect((opts as RequestInit).headers).toHaveProperty("User-Agent");
```

(Les lignes « Conformité » existantes sont remplacées par ce bloc, pas dupliquées.)

Run : `npx vitest run "src/app/api/products/openfoodfacts"`
Expected : FAIL (`image_url` présent dans la réponse).

- [ ] **Step 2 : Retirer l'image de la route OFF**

Dans `src/app/api/products/openfoodfacts/[barcode]/route.ts` :
- URL : `?fields=product_name,product_name_fr,code,image_front_url` → `?fields=product_name,product_name_fr,code`
- Objet `product` : supprimer la ligne `image_url: data.product.image_front_url || null,`

Run : `npx vitest run "src/app/api/products/openfoodfacts"`
Expected : PASS.

- [ ] **Step 3 : Retirer `images.remotePatterns` de `next.config.ts`**

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
};

export default nextConfig;
```

- [ ] **Step 4 : `page.tsx` — imports, types, état**

- Supprimer `import Image from "next/image";` (l.4).
- Ajouter après l'import `BarcodeScanner` :

```ts
import {
  type ScannedProduct,
  fromMemory,
  fromOpenFoodFacts,
  editName,
  applyImprovedName,
  nameSourceLabel,
  canSaveName,
} from "@/lib/scanned-product";
```

- Supprimer l'interface `OpenFoodProduct` (l.38-42).
- Remplacer `useState<OpenFoodProduct | null>(null)` par `useState<ScannedProduct | null>(null)` pour `scannedProduct`.

- [ ] **Step 5 : `page.tsx` — flux de scan**

Remplacer intégralement `handleScan` et `improveProductName` par :

```ts
  const fetchKnownName = async (barcode: string): Promise<string | null> => {
    try {
      const response = await fetch(`/api/known-products/${encodeURIComponent(barcode)}`);
      if (response.status === 404) return null;
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      return typeof data.name === "string" ? data.name : null;
    } catch (err) {
      // La mémoire est un raccourci : en cas de panne on retombe sur OFF + LLM.
      console.error("Failed to read known product name", err);
      return null;
    }
  };

  const loadFromOpenFoodFacts = async (barcode: string, isRetry: boolean) => {
    try {
      const response = await fetch(`/api/products/openfoodfacts/${barcode}`);
      const data = await response.json();

      if (!response.ok) {
        if (response.status === 404 && !isRetry) {
          setManualForm({ productName: "", expirationDate: "", barcode });
          setIsManualAdding(true);
          setError(null);
        } else {
          setError(data.error || "Produit non trouvé");
        }
        return;
      }

      setScannedProduct(fromOpenFoodFacts(barcode, data.name));
      improveProductName(data.name, barcode);
    } catch {
      setError("Erreur lors de la récupération du produit");
    }
  };

  const handleScan = async (barcode: string) => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    setIsScanning(false); // Close scanner after scan

    try {
      const knownName = await fetchKnownName(barcode);
      if (knownName) {
        setScannedProduct(fromMemory(barcode, knownName));
        setExpirationDate("");
        return;
      }

      setExpirationDate("");
      await loadFromOpenFoodFacts(barcode, false);
    } finally {
      setLoading(false);
    }
  };

  const handleRetryLookup = async () => {
    if (!scannedProduct) return;

    setLoading(true);
    setError(null);
    try {
      await loadFromOpenFoodFacts(scannedProduct.barcode, true);
    } finally {
      setLoading(false);
    }
  };

  const improveProductName = async (originalName: string, barcode: string) => {
    let improvedName: string | null = null;
    try {
      const response = await fetch("/api/ai/improve-product-name", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productName: originalName }),
      });

      if (response.ok) {
        const data = await response.json();
        if (typeof data.improvedName === "string") improvedName = data.improvedName;
      }
    } catch (err) {
      console.error("Failed to improve product name", err);
    }
    setScannedProduct((prev) => applyImprovedName(prev, barcode, improvedName));
  };
```

- [ ] **Step 6 : `page.tsx` — enregistrement**

Dans `handleSaveProduct`, remplacer la garde initiale et le `productName` envoyé :

```ts
    if (!scannedProduct || !expirationDate || !canSaveName(scannedProduct)) {
      setError("Veuillez saisir un nom et sélectionner une date");
      return;
    }
```

```ts
          productName: scannedProduct.name.trim(),
```

- [ ] **Step 7 : `page.tsx` — carte produit**

Remplacer le bloc `<div className="bg-neo-pink …"> … </div>` (image + `<h2>` + code-barres) par :

```tsx
            <div className="bg-neo-pink border-2 border-black shadow-neo rounded-[1.5rem] p-4 text-center space-y-3">
              <label htmlFor="scanned-product-name" className="sr-only">Nom du produit</label>
              <input
                id="scanned-product-name"
                type="text"
                value={scannedProduct.name}
                onChange={(e) => setScannedProduct((prev) => editName(prev, e.target.value))}
                className="w-full block box-border bg-white border-2 border-black rounded-xl px-3 py-2 text-2xl font-black uppercase text-center focus:outline-none focus:ring-4 focus:ring-neo-yellow/50"
              />
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold uppercase tracking-widest">
                  {nameSourceLabel(scannedProduct)}
                </span>
                <button
                  type="button"
                  onClick={handleRetryLookup}
                  disabled={loading || scannedProduct.improving}
                  className="bg-white border-2 border-black shadow-neo hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] disabled:opacity-50 disabled:cursor-not-allowed font-bold px-3 py-1 rounded-xl text-sm transition-all"
                >
                  ↻ Relancer
                </button>
              </div>
              <p className="font-mono text-sm">{scannedProduct.barcode}</p>
            </div>
```

- [ ] **Step 8 : `page.tsx` — boutons de validation**

Sur les deux boutons « Valider et ajouter » et « Valider », remplacer :

```tsx
                disabled={loading || !expirationDate}
```

par :

```tsx
                disabled={loading || !expirationDate || !canSaveName(scannedProduct)}
```

- [ ] **Step 9 : Vérifications statiques**

Run : `npm test && npx tsc --noEmit && npm run lint && npm run build`
Expected : tous les tests PASS ; aucune erreur TS ; lint sans erreur ; build OK. `grep -n "image_url\|next/image" src/app/page.tsx` ne renvoie rien.

- [ ] **Step 10 : Commit**

```bash
git add next.config.ts src/app/page.tsx "src/app/api/products/openfoodfacts"
git commit -m "feat: nom modifiable au scan, mémoire des noms et bouton Relancer

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6 : Vérification manuelle dans le navigateur

**Files :** aucun (vérification uniquement).

Préparer la base de dev : `npx prisma migrate deploy` (applique `add_known_product` à `prisma/data/dev.db`), puis lancer le serveur HTTPS de dev (`node dev-https.js`, nécessaire pour la caméra sur téléphone). Le scan caméra n'est pas automatisable : ces vérifications sont faites par l'utilisateur avec un vrai scan, en observant l'onglet réseau (inspection à distance du navigateur mobile).

- [ ] **Step 1 : Code inconnu** — scanner un article jamais vu : requêtes `known-products` (404) → `openfoodfacts` → `improve-product-name` ; libellé « Amélioration… » puis « Amélioré par IA » ; ajouter le produit.
- [ ] **Step 2 : Code connu** — rescanner le même article : une seule requête `known-products` (200), **aucune** requête `openfoodfacts` ni `improve-product-name` ; libellé « Nom mémorisé » ; nom identique à celui validé.
- [ ] **Step 3 : Course LLM / saisie** — scanner un article inconnu et taper immédiatement dans le champ : la réponse LLM n'écrase pas la saisie ; le nom validé est celui tapé et devient le nom mémorisé (vérifier par rescan).
- [ ] **Step 4 : Relancer** — sur un article mémorisé, cliquer « ↻ Relancer » : requêtes `openfoodfacts` + `improve-product-name`, nouveau nom proposé ; revenir sans valider puis rescanner → toujours l'ancien nom mémorisé.
- [ ] **Step 5 : Renommage via la modale** — renommer un produit de la liste, puis rescanner ce code-barres → nouveau nom proposé ; modifier seulement la date d'un autre produit → son nom mémorisé inchangé.
- [ ] **Step 6 : Nom vide** — vider le champ : boutons de validation désactivés.

Reporter tout écart avant de clôturer la branche.
