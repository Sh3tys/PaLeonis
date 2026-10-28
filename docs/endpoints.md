# Contrat d'API PaLeonis

Base : `http://localhost:3000/api`. Erreurs au format `{ "error": "..." }` (plus `details` pour un 422).

## Endpoints du TP 3 (PostgreSQL)

| Méthode | Route | Rôle | Codes |
| --- | --- | --- | --- |
| GET | `/clients` | Lister | 200 |
| GET | `/clients/{id}` | Consulter | 200, 404 |
| POST | `/clients` | Créer | 201, 400, 409 |
| GET | `/clients/{id}/fiche` | Client, abonnements, offres, serveurs | 200, 404 |
| GET | `/offres` | Lister (`?categorie=&en_vente=`) | 200, 400 |
| POST | `/offres` | Créer | 201, 400 |
| PUT | `/offres/{id}` | Modifier | 200, 400, 404 |
| PATCH | `/offres/{id}/retrait` | Retirer de la vente | 200, 404 |
| POST | `/abonnements` | Souscrire et attribuer un serveur | 201, 400, 404, 409 |
| GET | `/abonnements` | Lister | 200 |
| GET | `/abonnements/{id}` | Consulter | 200, 404 |
| PATCH | `/abonnements/{id}/resiliation` | Résilier et libérer le serveur | 200, 404, 409 |
| GET | `/serveurs` | Lister (`?datacenter=&statut=&attribue=`) | 200 |
| GET | `/serveurs/{id}` | Consulter | 200, 404 |
| POST | `/tickets` | Ouvrir | 201, 400, 404 |
| PATCH | `/tickets/{id}/assignation` | Assigner à un technicien | 200, 400, 404 |
| PATCH | `/tickets/{id}/status` | Faire évoluer le statut | 200, 400, 404 |
| GET | `/techniciens` | Lister | 200 |
| GET | `/techniciens/{id}` | Consulter | 200, 404 |
| GET | `/techniciens/{id}/tickets` | Tickets non fermés, triés par priorité | 200, 404 |
| GET | `/dashboard/revenus` | CA mensuel, total et par catégorie | 200 |
| GET | `/dashboard/serveurs` | Serveurs par datacenter et statut | 200 |

## Nouveaux endpoints du TP 4 (PostgreSQL + MongoDB)

### N1. Fiches techniques

| Méthode | Route | Rôle | Codes |
| --- | --- | --- | --- |
| GET | `/offres/{id}` | **Modifié** : l'offre (PostgreSQL) et sa `fiche_technique` (MongoDB, `null` si absente) | 200, 400, 404 |
| GET | `/offres/{id}/fiche` | Consulter la fiche | 200, 404 |
| PUT | `/offres/{id}/fiche` | Créer ou remplacer la fiche, validée selon la catégorie de l'offre | 201 (créée), 200 (remplacée), 404, 422 |
| GET | `/offres/recherche?q=NVMe` | Recherche plein texte dans les fiches, renvoie les offres | 200, 400 |
| DELETE | `/offres/{id}` | Supprimer l'offre **et sa fiche** | 204, 404, 409 (offre souscrite) |

Champs obligatoires par catégorie (la catégorie est lue dans PostgreSQL, jamais dans le corps) :

- `VPS` : `vcpu`, `ramGo`, `stockageGo`, `systeme` (`typeStockage` : HDD, SSD, NVMe)
- `HEBERGEMENT_MUTUALISE` : `espaceDisqueGo`, `nbSitesMax` (`nbBasesDonnees`, `certificatSsl`)
- `SERVEUR_DEDIE` : `processeur`, `ramGo`, `disques` (au moins un `{ type, capaciteGo }`), `bandePassanteMbps`
- `NOM_DE_DOMAINE` : `extension` (ex. `.fr`), `registrar`, `dureeEngagementMois`
- toutes : `caracteristiques`, objet libre pour les nouvelles caractéristiques

Si `PUT /offres/{id}` change la catégorie, l'ancienne fiche est supprimée.

```json
PUT /offres/2/fiche
{ "vcpu": 4, "ramGo": 8, "stockageGo": 160, "typeStockage": "NVMe", "systeme": "Ubuntu 24.04 LTS", "caracteristiques": { "ipv6": true } }
```

### N2. Journal d'activité des serveurs

| Méthode | Route | Rôle | Codes |
| --- | --- | --- | --- |
| POST | `/serveurs/{id}/evenements` | Enregistrer un événement | 201, 400, 404, 422 |
| GET | `/serveurs/{id}/evenements` | Lister, du plus récent au plus ancien. Filtres `type`, `debut`, `fin` (ISO 8601), `limite` (1–500, défaut 50) | 200, 400, 404 |
| GET | `/serveurs/{id}/evenements/stats` | Nombre d'événements par type (`aggregate`) | 200, 404 |
| GET | `/serveurs/alertes/par-jour` | Alertes par jour et par serveur sur 7 jours (`aggregate`) | 200 |
| DELETE | `/serveurs/{id}` | Supprimer le serveur **et son journal** | 204, 404, 409 (serveur attribué) |

Champs par `type` :

- `REDEMARRAGE` : `motif` (`planifie`, `dureeSecondes`)
- `ALERTE` : `niveau` (INFO, AVERTISSEMENT, CRITIQUE), `message`
- `MAINTENANCE` : `description` (`technicienId`, vérifié dans PostgreSQL ; `dureeMinutes`)
- `METRIQUE` : `cpu`, `ram`, `disque` (pourcentages de 0 à 100). Expiration automatique après 90 jours (index TTL)

`date` est facultative (par défaut, maintenant).

```json
POST /serveurs/1/evenements
{ "type": "ALERTE", "niveau": "CRITIQUE", "message": "Disque /var rempli à 95 %" }
```

### N3. Échanges sur les tickets

| Méthode | Route | Rôle | Codes |
| --- | --- | --- | --- |
| GET | `/tickets/{id}` | **Modifié** : le ticket et tout son fil `messages`, dans l'ordre chronologique | 200, 400, 404 |
| POST | `/tickets/{id}/messages` | Ajouter un message | 201, 403, 404, 409 (ticket fermé), 422 |
| DELETE | `/tickets/{id}` | Supprimer le ticket **et ses messages** | 204, 404 |

L'auteur est `{ "type": "CLIENT" | "TECHNICIEN", "id": entier }`. Un client doit être celui du ticket (sinon 403) ; un technicien doit exister (sinon 404).

```json
POST /tickets/1/messages
{
  "auteur": { "type": "TECHNICIEN", "id": 1 },
  "contenu": "Le service sshd a été redémarré.",
  "piecesJointes": [{ "nom": "journal.txt", "url": "https://files.paleonis.fr/t1/journal.txt" }]
}
```

## Erreurs MongoDB

| Cas | Code |
| --- | --- |
| `ValidationError` (document non conforme au schéma) | 422 |
| `CastError` (valeur au mauvais format) | 400 |
| `code 11000` (doublon sur un index unique) | 409 |
