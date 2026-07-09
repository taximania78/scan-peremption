# Scan de Péremption

Application web Mobile First pour scanner des codes-barres alimentaires, récupérer les informations via l'API Open Food Facts et enregistrer les dates de péremption dans une base de données locale.

## Caractéristiques

- Scanner de codes-barres via la caméra du mobile
- Recherche de produits via l'API Open Food Facts
- Enregistrement des dates de péremption
- Liste des produits avec alertes de péremption (expiré, proche, bon)
- Interface Mobile First responsive
- Auto-hébergable via Docker

## Stack technique

- **Frontend**: Next.js 16 avec TypeScript et Tailwind CSS
- **Scanner**: html5-qrcode
- **Base de données**: SQLite avec Prisma ORM
- **Hébergement**: Docker Compose

## Installation locale

1. Cloner le repository
2. Installer les dépendances:

```bash
npm install
```

3. Configurer les variables d'environnement:

```bash
cp .env.example .env
```

Puis éditez `.env` (voir la section [Configuration](#configuration)).

4. Initialiser la base de données:

```bash
npx prisma generate
npx prisma migrate dev
```

5. Lancer le serveur de développement:

```bash
npm run dev
```

L'application sera disponible sur [http://localhost:3000](http://localhost:3000)

## Configuration

Les variables d'environnement (voir `.env.example`) :

| Variable | Requise | Description |
|----------|---------|-------------|
| `DATABASE_URL` | oui | Chemin de la base SQLite (Prisma). |
| `OPENROUTER_API_KEY` | non | Clé [OpenRouter](https://openrouter.ai/keys) pour reformuler les noms de produits via IA. Sans elle, le nom brut est conservé. |
| `OFF_USER_AGENT` | non | User-Agent envoyé à Open Food Facts, au format `AppName/Version (Contact)`. |
| `APP_URL` / `APP_TITLE` | non | En-têtes d'attribution envoyés à OpenRouter. |

> ⚠️ **Sécurité** — Les routes API n'ont ni authentification ni limitation de débit. Cette application est conçue pour un usage personnel en **réseau local** (auto-hébergement). Si vous l'exposez sur Internet, placez-la derrière une authentification (reverse proxy, VPN…) ; sans cela, la route IA pourrait être appelée par des tiers et consommer vos crédits OpenRouter.

## Déploiement avec Docker

1. Construire l'image Docker:

```bash
docker-compose build
```

2. Lancer le conteneur:

```bash
docker-compose up -d
```

L'application sera disponible sur [http://localhost:3000](http://localhost:3000)

3. Arrêter le conteneur:

```bash
docker-compose down
```

## Structure du projet

```
src/
├── app/
│   ├── api/
│   │   └── products/
│   │       ├── route.ts              # GET (list) / POST (save) products
│   │       ├── [id]/route.ts         # DELETE product
│   │       └── openfoodfacts/
│   │           └── [barcode]/route.ts  # GET product from Open Food Facts
│   └── page.tsx                      # Main page
├── components/
│   └── BarcodeScanner.tsx           # Barcode scanner component
└── lib/
    └── prisma.ts                    # Prisma client singleton

prisma/
├── schema.prisma                     # Database schema
└── migrations/                       # Database migrations

Dockerfile                            # Docker configuration
docker-compose.yml                    # Docker Compose configuration
```

## API Endpoints

### GET /api/products
Récupère la liste de tous les produits enregistrés.

### POST /api/products
Enregistre un nouveau produit.

Body:
```json
{
  "barcode": "string",
  "productName": "string",
  "expirationDate": "ISO 8601 date"
}
```

### PATCH /api/products/[id]
Modifie le nom et/ou la date de péremption d'un produit.

### DELETE /api/products/[id]
Supprime un produit par son ID.

### GET /api/products/list
Liste allégée des produits (id, nom, date de péremption).

### GET /api/products/expiring-soon
Produits expirant dans les 3 prochains jours.

### GET /api/products/openfoodfacts/[barcode]
Récupère les informations d'un produit depuis l'API Open Food Facts (v3).

## Données & attribution

Les informations produits proviennent d'[**Open Food Facts**](https://world.openfoodfacts.org), une base de données alimentaire collaborative et ouverte.

Les données sont mises à disposition sous licence [Open Database License (ODbL)](https://opendatacommons.org/licenses/odbl/1-0/) ; les contenus individuels sous [Database Contents License](https://opendatacommons.org/licenses/dbcl/1-0/) et les images sous [Creative Commons Attribution ShareAlike](https://creativecommons.org/licenses/by-sa/3.0/). L'utilisation de l'API est soumise à un User-Agent personnalisé et à des limites de débit (15 requêtes/min/IP en lecture).

La reformulation des noms de produits est assurée par [OpenRouter](https://openrouter.ai).

## Sécurité

Le modèle de sécurité et la procédure de signalement d'une vulnérabilité sont décrits dans [SECURITY.md](SECURITY.md).

## Contributions

Projet personnel, maintenu sur le temps libre. Les issues sont les bienvenues. Les pull requests ne sont pas activement suivies : ouvrez une issue avant d'investir du temps sur un correctif.

## Licence

Ce projet est sous licence MIT — voir le fichier [LICENSE](LICENSE).
