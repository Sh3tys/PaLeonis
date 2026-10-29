# Fiche projet : API REST Express MVC hybride (PostgreSQL + MongoDB)

Le but de cette fiche : comprendre en 5 minutes à quoi sert chaque fichier, pour pouvoir **repartir de ce projet comme d'un template**. On copie la structure, on renomme les ressources, on adapte.

---

## 1. Les stacks utilisées

| Outil | Rôle dans le projet | Pourquoi ce choix |
| --- | --- | --- |
| **Node.js** (≥ 20) | Environnement d'exécution JavaScript côté serveur. | Un seul langage partout, énorme écosystème npm. |
| **Express 5** | Framework HTTP : routes, middlewares, réponses JSON. | Minimaliste. La version 5 envoie toute seule les erreurs des fonctions `async` au gestionnaire d'erreurs, donc pas besoin de `try/catch` partout. |
| **PostgreSQL 16** | Base relationnelle : clients, offres, serveurs, abonnements, tickets. | Données **liées entre elles** qu'il faut garder cohérentes : clés étrangères, contraintes, **transactions** (ex. une souscription réserve un serveur). |
| **pg** (node-postgres) | Driver Node vers PostgreSQL. On écrit le SQL à la main. | Simple et transparent : on voit exactement les requêtes envoyées. Requêtes paramétrées (`$1`, `$2`) contre l'injection SQL. |
| **MongoDB 7** | Base de documents : fiches techniques, journal d'événements, messages de tickets. | Données dont la **structure change** (une fiche VPS ≠ une fiche nom de domaine), **gros volume d'écriture** (journal), listes qui grossissent sans limite (messages). |
| **Mongoose** | ODM pour MongoDB : schémas, validation, index. | MongoDB n'impose aucune structure ; Mongoose rajoute une validation côté code. Les *discriminators* donnent un schéma par sous-type dans une seule collection. |
| **Docker / Docker Compose** | Lance PostgreSQL et Adminer dans des conteneurs. | Même environnement pour tout le monde, rien à installer à part Docker. `docker compose down -v` remet la base à zéro. |
| **Adminer** | Interface web pour voir et requêter PostgreSQL (`http://localhost:8080`). | Équivalent léger de **pgAdmin** : une seule image Docker, aucune configuration. Pour se connecter : système *PostgreSQL*, serveur `db`, et les identifiants du `.env`. On peut le remplacer par pgAdmin (`image: dpage/pgadmin4`) si on préfère. |
| **MongoDB Compass / mongosh** | Voir les documents MongoDB (facultatif). | Compass = interface graphique, mongosh = ligne de commande. |
| **dotenv** | Charge le fichier `.env` dans `process.env`. | Les mots de passe et URLs restent hors du code (et hors de Git). |
| **nodemon** (dev) | Redémarre l'API à chaque sauvegarde (`npm run dev`). | Confort de développement. |
| **Postman** | Tester les routes (collection dans `docs/postman/`). | Toutes les requêtes prêtes à l'emploi. |

**Règle pour choisir la base** : si la donnée a des liens forts et a besoin de transactions → PostgreSQL. Si sa forme varie, qu'elle est écrite en masse sans jamais être modifiée, ou qu'elle forme une liste sans fin → MongoDB. Le détail est dans [`arbitrage.md`](arbitrage.md).

---

## 2. Architecture MVC : le trajet d'une requête

```
Client HTTP (Postman)
   │  GET /api/offres/1
   ▼
server.js ──── middlewares (express.json) puis montage des routes sous /api
   ▼
routes/*.routes.js ──── "quelle URL appelle quelle fonction" (aucune logique)
   ▼
controllers/*.controller.js ──── lit req, appelle le(s) modèle(s), choisit le code HTTP
   ▼
models/*.model.js ──── seul endroit qui parle aux bases
   ├── modèles SQL      → src/db.js           → PostgreSQL
   └── modèles Mongoose → src/config/mongo.js → MongoDB
   ▼
réponse JSON  (ou erreur → gestionnaire d'erreurs central dans server.js)
```

Pas de *Vue* au sens HTML : c'est une API, la « vue » est le JSON renvoyé (méthodes `toJSON()` des modèles).

**Lien entre les deux bases** : MongoDB ne connaît pas les tables PostgreSQL. Les documents gardent l'id PostgreSQL (`offreId`, `serveurId`, `ticketId`). Le contrôleur **vérifie dans PostgreSQL** que l'élément existe avant d'écrire dans MongoDB, et fait la **suppression en cascade à la main** (PostgreSQL d'abord, MongoDB ensuite).

---

## 3. Fichier par fichier

### Racine

| Fichier | À quoi il sert | À adapter pour un nouveau projet |
| --- | --- | --- |
| `package.json` | Nom du projet, dépendances, scripts `npm start` / `npm run dev`. | Le nom ; ajouter les dépendances dont on a besoin. |
| `package-lock.json` | Versions exactes installées (généré par npm). | Ne pas toucher, il se régénère. |
| `.env.example` | Modèle des variables d'environnement, commité. | Les noms de base, ports, URLs. |
| `.env` | Vraies valeurs locales (mots de passe). **Jamais commité.** | Créé par `cp .env.example .env`. |
| `.gitignore` | Exclut `node_modules/` et `.env` de Git. | Rarement. |
| `docker-compose.yml` | Lance PostgreSQL (+ chargement auto du SQL) et Adminer. | Noms de conteneurs ; ajouter un service `mongo` si on veut aussi MongoDB en Docker. |
| `README.md` | Installation et démarrage pas à pas. | Tout le contenu. |

### `database/` (PostgreSQL)

| Fichier | À quoi il sert |
| --- | --- |
| `schema.sql` | Crée les types ENUM, les tables, les contraintes (FK, CHECK, UNIQUE) et un trigger qui met à jour `modifie_le`. Exécuté automatiquement au premier `docker compose up`. |
| `seed.sql` | Jeu d'essai (datacenters, offres, serveurs, clients, abonnements, tickets). Exécuté juste après `schema.sql` (ordre alphabétique). |

### `scripts/`

| Fichier | À quoi il sert |
| --- | --- |
| `seed-mongo.js` | Vide puis remplit les collections MongoDB avec des données cohérentes avec les ids de `seed.sql`. Lancer : `node scripts/seed-mongo.js`. |

### `src/` : socle

| Fichier | À quoi il sert |
| --- | --- |
| `server.js` | Point d'entrée. Charge `.env`, crée l'app Express, monte les routes, gère les 404 et **toutes les erreurs** (traduit erreurs PostgreSQL / Mongoose en codes HTTP), vérifie les deux connexions puis démarre. |
| `db.js` | Pool de connexions PostgreSQL partagé par tous les modèles SQL. |
| `config/mongo.js` | Connexion unique à MongoDB via Mongoose. |

### `src/routes/` : les URLs

Un fichier par ressource. Il ne fait **que** relier `méthode + URL` → fonction du contrôleur.

| Fichier | Ressource |
| --- | --- |
| `abonnement.routes.js` | `/api/abonnements` : liste, détail, souscription, résiliation. |
| `catalogue.routes.js` | `/api/offres` : CRUD des offres, retrait de la vente, fiche technique, recherche texte. |
| `client.route.js` | `/api/clients` : liste, détail, création, fiche complète. |
| `dashboard.routes.js` | `/api/dashboard` : revenus et état du parc de serveurs. |
| `datacenter.routes.js` | `/api/datacenters` : liste et détail. |
| `serveur.routes.js` | `/api/serveurs` : serveurs + journal d'événements + statistiques. |
| `technicien.routes.js` | `/api/techniciens` : liste et détail. |
| `ticket.routes.js` | `/api/tickets` : création, détail avec messages, assignation, statut, suppression. |

> Piège classique : une route fixe (`/offres/recherche`) doit être déclarée **avant** une route à paramètre (`/offres/:id`), sinon `recherche` est pris pour un id.

### `src/controllers/` : la logique HTTP

Un fichier par ressource. Lit `req.params`, `req.query`, `req.body`, appelle les modèles, renvoie `res.status(...).json(...)`. Les règles qui croisent les deux bases (vérifier l'offre avant d'écrire sa fiche, cascade de suppression) sont ici.

| Fichier | Particularité |
| --- | --- |
| `abonnement.controller.js` | Très fin : toute la logique est dans le modèle. |
| `catalogue.controller.js` | Combine offre (SQL) + fiche (Mongo) ; supprime la fiche si la catégorie change. |
| `client.controller.js` | Valide lui-même le corps de requête et gère ses erreurs (autre style possible). |
| `dashboard.controller.js` | Renvoie juste les statistiques du modèle. |
| `datacenter.controller.js` | Valide l'id avant d'interroger la base. |
| `serveur.controller.js` | Interdit de supprimer un serveur attribué ; gère le journal d'événements. |
| `technicien.controller.js` | Lecture simple. |
| `ticket.controller.js` | Règles métier des messages (ticket fermé, auteur autorisé), cascade vers Mongo. |

### `src/models/` : l'accès aux données

**Modèles SQL** (utilisent `db.js`) : une classe avec des méthodes `static` (`findAll`, `findById`, `createOne`…). Les plus complets ont des champs privés `#`, un `#fromRow` (ligne SQL → objet) et un `toJSON()` (objet → réponse API).

| Fichier | Table | Particularité |
| --- | --- | --- |
| `abonnement.model.js` | `abonnement` | **Transaction** de souscription avec `FOR UPDATE SKIP LOCKED` pour ne jamais donner le même serveur à deux clients. |
| `catalogue.model.js` | `offre` | Validation des entrées, filtres facultatifs, mise à jour partielle avec `COALESCE`. |
| `client.model.js` | `client` + `particulier` / `entreprise` | Héritage en base, création dans une transaction, JSON imbriqué construit en SQL. |
| `dashboard.model.js` | (plusieurs) | Agrégations `SUM` / `COUNT` / `GROUP BY`. |
| `datacenter.model.js` | `datacenter` | Modèle minimal (renvoie les lignes brutes). |
| `serveur.model.js` | `serveur` | Calcule si le serveur est attribué via un `LEFT JOIN`. |
| `technicien.model.js` | `technicien` | Modèle minimal. |
| `ticket.model.js` | `ticket` | Machine à états des statuts (`peutPasserA`). |

**Modèles MongoDB** (utilisent Mongoose) : un schéma + des fonctions ajoutées au modèle.

| Fichier | Collection | Particularité |
| --- | --- | --- |
| `ficheTechnique.model.js` | `fiches_techniques` | Un *discriminator* par catégorie d'offre, champ libre `caracteristiques`, index texte. |
| `evenement.model.js` | `evenements` | Un *discriminator* par type d'événement, index TTL (purge auto des métriques après 90 jours), pipelines d'agrégation. |
| `message.model.js` | `messages` | Un document par message, relié au ticket par `ticketId`. |

### `docs/`

| Fichier | À quoi il sert |
| --- | --- |
| `fiche-projet.md` | Cette fiche. |
| `arbitrage.md` | Justifie chaque choix PostgreSQL / MongoDB. |
| `conception.md` | Notes de conception et répartition des tâches entre les membres de l'équipe. |
| `endpoints.md` | Contrat d'API : chaque route, son corps, ses réponses. |
| `postman/paleonis.postman_collection.json` | Collection Postman à importer pour tester. |

---

## 4. Refaire un projet semblable à partir de zéro

```bash
mkdir mon-api && cd mon-api
npm init -y
npm install express dotenv pg mongoose
npm install -D nodemon
mkdir -p src/{routes,controllers,models,config} database scripts docs
```

1. **Copier le socle** tel quel : `src/server.js`, `src/db.js`, `src/config/mongo.js`, `docker-compose.yml`, `.env.example`, `.gitignore`, et les scripts de `package.json`.
2. **Écrire `database/schema.sql`** avec ses tables, puis `seed.sql` avec quelques lignes de test.
3. **Pour chaque ressource**, créer les trois fichiers en partant d'un exemple simple :
   - `datacenter.model.js` → `xxx.model.js` (changer le nom de table et les colonnes)
   - `datacenter.controller.js` → `xxx.controller.js`
   - `datacenter.routes.js` → `xxx.routes.js`
   - puis une ligne dans `server.js` : `app.use("/api/xxx", xxxRoutes);`
4. **Si une donnée va dans MongoDB**, partir de `message.model.js` (le plus simple), ou de `ficheTechnique.model.js` si la structure varie selon un type.
5. **Démarrer** :

```bash
cp .env.example .env
docker compose up -d          # PostgreSQL + Adminer, SQL chargé automatiquement
node scripts/seed-mongo.js    # si MongoDB est utilisé
npm run dev
```

**Conventions à garder** :
- les routes ne contiennent pas de logique, les contrôleurs ne contiennent pas de SQL ;
- toujours des requêtes paramétrées (`$1`), jamais de concaténation de chaînes ;
- une erreur métier = `httpError(code, message)` levée dans le modèle, traduite par `server.js` ;
- les listes de valeurs (ENUM SQL et tableaux JS comme `CATEGORIES`) doivent rester identiques.
