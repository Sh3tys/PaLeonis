# PaLeonis API (hybride PostgreSQL + MongoDB)

API Express en MVC. Les données relationnelles (clients, offres, abonnements, serveurs, tickets) sont dans **PostgreSQL**. Les fiches techniques, le journal d'activité des serveurs et les messages de tickets sont dans **MongoDB**. Les choix sont justifiés dans [`docs/arbitrage.md`](docs/arbitrage.md), et le contrat d'API se trouve dans [`docs/endpoints.md`](docs/endpoints.md).

## Prérequis

- Node.js 20 ou plus
- Docker (pour PostgreSQL), **ou** un PostgreSQL 16 local
- MongoDB 7 : MongoDB Community Server en local, ou `docker run --name paleonis-mongo -p 27017:27017 -d mongo:7`
- Facultatif : MongoDB Compass ou `mongosh` pour voir les documents

## Installation

```bash
npm install
cp .env.example .env   # puis adapter les mots de passe et les ports
```

Variables utilisées par l'API :

| Variable | Exemple |
| --- | --- |
| `DATABASE_URL` | `postgresql://app:change_moi@localhost:5432/hosting` |
| `MONGO_URI` | `mongodb://127.0.0.1:27017/paleonis` |
| `PORT` | `3000` (par défaut) |

## 1. Lancer PostgreSQL et charger son jeu d'essai

```bash
docker compose up -d
```

Au **premier** démarrage, le conteneur exécute `database/schema.sql` puis `database/seed.sql`. Pour repartir de zéro :

```bash
docker compose down -v && docker compose up -d
```

Sans Docker : `psql "$DATABASE_URL" -f database/schema.sql -f database/seed.sql`.

## 2. Lancer MongoDB et charger son jeu d'essai

Démarrer MongoDB (service `mongod` ou conteneur `mongo:7`), puis :

```bash
node scripts/seed-mongo.js
```

Le script vide les collections `fiches_techniques`, `evenements` et `messages`, puis insère un jeu d'essai cohérent avec les ids de `seed.sql` : une fiche par offre (1 à 5), 50 événements sur les serveurs 1 à 3 répartis sur 10 jours, et des fils de messages sur les tickets 1 et 2.

> Le seed MongoDB suppose que `seed.sql` vient d'être chargé, pour que les ids correspondent.

## 3. Démarrer l'API

```bash
npm run dev    # ou npm start
```

Au démarrage, la console doit afficher :

```
Connecté à PostgreSQL
Connecté à MongoDB
Serveur PaLeonis démarré sur http://localhost:3000
```

Si l'une des deux bases est injoignable, l'API affiche l'erreur et s'arrête.

## Tester

Importer `docs/postman/paleonis.postman_collection.json` dans Postman (variable `baseUrl` = `http://localhost:3000/api`).

Cohérence entre les deux bases : l'API vérifie dans PostgreSQL que l'offre, le serveur, le ticket ou l'auteur existe avant d'écrire dans MongoDB. Supprimer une offre, un serveur ou un ticket supprime aussi ses documents MongoDB (`DELETE /api/offres/:id`, `/api/serveurs/:id`, `/api/tickets/:id`).
