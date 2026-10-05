# Édition du nom au scan et mémoire des noms de produits

Date : 2026-10-05
Branche : `feature/edition-nom-et-cache-produits`

## Objectif

1. Pouvoir corriger le nom d'un produit directement sur l'écran de confirmation après un scan, avant l'ajout.
2. Mémoriser le nom retenu pour chaque code-barres afin que les scans suivants du même article réutilisent ce nom sans appeler Open Food Facts (OFF) ni le LLM (OpenRouter).

### Critères de succès

- Scanner un article déjà traité affiche immédiatement le nom mémorisé, sans aucune requête vers OFF ni OpenRouter.
- Le nom est modifiable avant l'ajout ; le nom validé est celui enregistré et mémorisé.
- Renommer un produit plus tard (modale d'édition de la liste) met aussi à jour le nom mémorisé.
- Un bouton permet de relancer OFF + LLM manuellement, en ignorant la mémoire.

## Hors périmètre

- Aucune interface pour consulter ou supprimer les noms mémorisés. On corrige un nom mémorisé en renommant un produit (scan ou modale d'édition).
- Aucune image produit : l'image OFF est retirée de l'application.

## Modèle de données

Nouvelle table dans la base SQLite existante (Prisma), via une migration :

```prisma
model KnownProduct {
  barcode   String   @id
  name      String
  updatedAt DateTime @updatedAt
}
```

- Aucune relation avec `Product` : supprimer un produit du stock ne fait pas oublier son nom.
- Les codes-barres factices `MANUAL-<timestamp>` (ajouts manuels sans code-barres) ne sont jamais mémorisés.

## Serveur

### `src/lib/known-products.ts`

- `findKnownName(barcode: string): Promise<string | null>` : renvoie le nom mémorisé ou `null`.
- `rememberName(tx, barcode: string, name: string): Promise<void>` : upsert de `{ barcode, name: name.trim() }`. Ne fait rien si `barcode` commence par `MANUAL-`, ou si le nom est vide une fois les espaces retirés. Reçoit un client de transaction Prisma pour s'exécuter dans la même transaction que l'écriture du produit.

### `GET /api/known-products/[barcode]` (nouvelle route)

- 200 `{ name }` si le code est connu.
- 404 `{ error }` sinon.
- 500 `{ error }` en cas d'erreur de base.

### `POST /api/products` (modifiée)

Création du produit et `rememberName(barcode, productName)` dans une même `prisma.$transaction`. Si l'une des deux opérations échoue, la requête renvoie le 500 actuel et rien n'est écrit.

### `PATCH /api/products/[id]` (modifiée)

Si `productName` est fourni : dans une transaction, mise à jour du produit, puis `rememberName(updated.barcode, productName)`. Si seule la date change, la mémoire n'est pas touchée. La gestion actuelle du 404 (`P2025`) est conservée.

### `GET /api/products/openfoodfacts/[barcode]` (nettoyage)

On retire `image_front_url` du paramètre `fields=` et `image_url` de la réponse. Pas d'autre changement de comportement.

### `next.config.ts`

On supprime le bloc `images.remotePatterns` (`images.openfoodfacts.org`), qui ne servait qu'à l'image produit.

## Client (`src/app/page.tsx`)

### Enchaînement au scan

1. `GET /api/known-products/{barcode}` :
   - 200 → nom pré-rempli, source `"memory"`, aucun autre appel.
   - 404, erreur réseau ou 500 → étape 2 (une panne de la mémoire ne bloque pas le scan).
2. Parcours actuel : OFF, puis amélioration du nom par le LLM en différé. Un 404 OFF bascule toujours sur le formulaire d'ajout manuel, avec le code-barres pré-rempli. Ce produit sera mémorisé à son ajout.

### Carte du produit

- On retire l'image et le 🍎 de remplacement, ainsi que l'import `next/image` s'il n'est plus utilisé.
- Le `<h2>` du nom devient un champ texte pré-rempli, toujours modifiable, au style visuel équivalent (gras, majuscules).
- Le code-barres reste affiché en dessous.
- Un bouton **« ↻ Relancer »** relance OFF puis le LLM sans consulter la mémoire. Il est désactivé pendant les appels en cours. Un 404 OFF à ce moment-là affiche une erreur, sans basculer sur l'ajout manuel, et le nom courant est conservé.
- Un libellé discret indique la source du nom : « Nom mémorisé » (`memory`), « Open Food Facts » (`off`), « Amélioration… » pendant l'appel au LLM, puis « Amélioré par IA » (`ai`).
- Les boutons « Valider et ajouter » et « Valider » sont désactivés si le nom est vide une fois les espaces retirés, en plus de la condition actuelle sur la date.

### État

- `scannedProduct: { name, barcode }` (le champ `image_url` disparaît du type `OpenFoodProduct`).
- `nameSource: "memory" | "off" | "ai"`, `improving: boolean`.
- `nameEdited: boolean` : passe à `true` à la première frappe dans le champ. Quand il vaut `true`, la réponse du LLM qui arrive ensuite est ignorée. Il est remis à `false` à chaque nouveau scan et à chaque « Relancer ».
- La garde existante `prev.barcode === barcode` est conservée.

### Ajout

`handleSaveProduct` envoie `scannedProduct.name.trim()`. La mémorisation se fait côté serveur, sans appel supplémentaire depuis le client.

## Gestion des erreurs

| Situation | Comportement |
|---|---|
| Mémoire indisponible au scan | Repli silencieux sur OFF + LLM (`console.error`) |
| Échec du LLM | Le nom OFF est conservé (comme aujourd'hui) |
| Échec de l'upsert en mémoire | Produit non créé ou non modifié, erreur 500 actuelle |
| 404 OFF via « Relancer » | Message d'erreur, nom courant conservé |

## Tests (Vitest, Prisma mocké comme dans les tests existants)

- `src/lib/known-products.test.ts` : `rememberName` ignore `MANUAL-*` et les noms vides, et fait un upsert du nom sans espaces superflus ; `findKnownName` renvoie le nom ou `null`.
- `src/app/api/known-products/[barcode]/route.test.ts` : 200 si connu, 404 sinon, 500 si erreur.
- `src/app/api/products/route.test.ts` : le POST mémorise le nom ; aucune mémorisation pour `MANUAL-*` ; un échec de la transaction donne 500.
- `src/app/api/products/[id]/route.test.ts` : le PATCH avec `productName` mémorise le nom ; un PATCH sur la date seule ne touche pas la mémoire.
- `src/app/api/products/openfoodfacts/[barcode]/route.test.ts` : à mettre à jour (plus d'`image_url`).
- Interface (le repo n'a pas de tests de composants) : vérification manuelle dans le navigateur, sur un code connu (aucune requête OFF ni OpenRouter dans l'onglet réseau), un code inconnu, la course entre la réponse du LLM et la saisie, « Relancer », et un renommage via la modale suivi d'un nouveau scan.
