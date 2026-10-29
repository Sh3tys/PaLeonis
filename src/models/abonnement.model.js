// Modèle SQL : seul endroit qui écrit des requêtes vers PostgreSQL pour cette table.
// Contient la souscription, faite dans une transaction pour rester cohérente.

const pool = require("../db");

// Crée une erreur portant un code HTTP : server.js la renverra telle quelle au client.
const httpError = (status, message) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

const isPositiveInt = (value) => Number.isInteger(value) && value > 0;

// Champs privés (#) + getters : l'objet est en lecture seule depuis l'extérieur.
class Abonnement {
  #id;
  #clientId;
  #offreId;
  #serveurId;
  #dateDebut;
  #dateFin;
  #statut;
  #prixApplique;

  constructor(
    id,
    clientId,
    offreId,
    serveurId,
    dateDebut,
    dateFin,
    statut,
    prixApplique,
  ) {
    this.#id = id;
    this.#clientId = clientId;
    this.#offreId = offreId;
    this.#serveurId = serveurId;
    this.#dateDebut = dateDebut;
    this.#dateFin = dateFin;
    this.#statut = statut;
    this.#prixApplique = prixApplique;
  }

  get id() {
    return this.#id;
  }

  get clientId() {
    return this.#clientId;
  }

  get offreId() {
    return this.#offreId;
  }

  get serveurId() {
    return this.#serveurId;
  }

  get dateDebut() {
    return this.#dateDebut;
  }

  get dateFin() {
    return this.#dateFin;
  }

  get statut() {
    return this.#statut;
  }

  get prixApplique() {
    return this.#prixApplique;
  }

  // Appelé automatiquement par res.json() : définit la forme exacte renvoyée par l'API.
  toJSON() {
    return {
      id: this.#id,
      client_id: this.#clientId,
      offre_id: this.#offreId,
      serveur_id: this.#serveurId,
      date_debut: this.#dateDebut,
      date_fin: this.#dateFin,
      statut: this.#statut,
      prix_applique: this.#prixApplique,
    };
  }

  // Convertit une ligne SQL (snake_case) en instance du modèle.
  // NUMERIC arrive en chaîne depuis pg : Number() le remet en nombre.
  static #fromRow(row) {
    return new Abonnement(
      row.id,
      row.client_id,
      row.offre_id,
      row.serveur_id,
      row.date_debut,
      row.date_fin,
      row.statut,
      Number(row.prix_applique),
    );
  }

  static async findAll() {
    const { rows } = await pool.query("SELECT * FROM abonnement ORDER BY id");
    return rows.map(Abonnement.#fromRow);
  }

  static async findById(id) {
    const { rows } = await pool.query("SELECT * FROM abonnement WHERE id = $1", [id]);
    return rows[0] ? Abonnement.#fromRow(rows[0]) : null;
  }

  // Souscription : valide l'entrée, puis vérifie et réserve un serveur dans une seule transaction.
  static async createOne(dto) {
    const { client_id, offre_id, datacenter_id } = dto ?? {};

    if (!isPositiveInt(client_id)) {
      throw httpError(400, "client_id est obligatoire et doit être un entier positif.");
    }
    if (!isPositiveInt(offre_id)) {
      throw httpError(400, "offre_id est obligatoire et doit être un entier positif.");
    }
    if (!isPositiveInt(datacenter_id)) {
      throw httpError(400, "datacenter_id est obligatoire et doit être un entier positif.");
    }

    // Une transaction exige la même connexion pour toutes ses requêtes : on la prend au pool.
    const db = await pool.connect();
    try {
      await db.query("BEGIN");

      const client = await db.query("SELECT 1 FROM client WHERE id = $1", [client_id]);
      if (client.rowCount === 0) {
        throw httpError(404, "Client introuvable.");
      }

      const offre = await db.query(
        "SELECT prix_mensuel_ht, en_vente FROM offre WHERE id = $1",
        [offre_id],
      );
      if (offre.rowCount === 0) {
        throw httpError(404, "Offre introuvable.");
      }
      if (!offre.rows[0].en_vente) {
        throw httpError(409, "Cette offre a été retirée de la vente.");
      }

      const datacenter = await db.query("SELECT 1 FROM datacenter WHERE id = $1", [
        datacenter_id,
      ]);
      if (datacenter.rowCount === 0) {
        throw httpError(404, "Datacenter introuvable.");
      }

      // Premier serveur libre du datacenter. FOR UPDATE SKIP LOCKED verrouille la ligne :
      // deux souscriptions simultanées ne peuvent pas obtenir le même serveur.
      const serveur = await db.query(
        `SELECT s.id FROM serveur s
         WHERE s.datacenter_id = $1
           AND s.statut = 'EN_SERVICE'
           AND NOT EXISTS (SELECT 1 FROM abonnement a WHERE a.serveur_id = s.id)
         ORDER BY s.id
         LIMIT 1
         FOR UPDATE SKIP LOCKED`,
        [datacenter_id],
      );
      if (serveur.rowCount === 0) {
        throw httpError(409, "Aucun serveur libre dans ce datacenter.");
      }

      const { rows } = await db.query(
        `INSERT INTO abonnement (client_id, offre_id, serveur_id, prix_applique)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [client_id, offre_id, serveur.rows[0].id, offre.rows[0].prix_mensuel_ht],
      );

      await db.query("COMMIT");
      return Abonnement.findById(rows[0].id);
    } catch (error) {
      // Toute erreur annule l'ensemble de la transaction.
      await db.query("ROLLBACK");
      if (error.code === "23505") {
        throw httpError(409, "Ce serveur vient d'être attribué, réessayez.");
      }
      throw error;
    } finally {
      // Toujours rendre la connexion au pool, même en cas d'erreur.
      db.release();
    }
  }
  
  // Résiliation : on garde la ligne pour l'historique et on libère le serveur.
  static async resilier(id) {
    const abonnement = await Abonnement.findById(id);
    if (!abonnement) {
      return null;
    }
    if (abonnement.statut === "RESILIE") {
      throw httpError(409, "Abonnement déjà résilié.");
    }

    await pool.query(
      `UPDATE abonnement
       SET statut = 'RESILIE', date_fin = CURRENT_DATE, serveur_id = NULL
       WHERE id = $1`,
      [id],
    );
    return Abonnement.findById(id);
  }
}

module.exports = Abonnement;
