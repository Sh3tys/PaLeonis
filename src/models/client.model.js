// Modèle SQL : seul endroit qui écrit des requêtes vers PostgreSQL pour cette table.
// Héritage en base : client (commun) + particulier OU entreprise (spécifique).

const pool = require("../db");

// Requête de base réutilisée : les LEFT JOIN récupèrent les colonnes du sous-type.
const SELECT_CLIENT = `
  SELECT c.id, c.type, c.email, c.tel, c.date_inscription, c.cree_le, c.modifie_le,
         p.nom, e.siret, e.raison_sociale
  FROM client c
  LEFT JOIN particulier p ON p.client_id = c.id
  LEFT JOIN entreprise  e ON e.client_id = c.id
`;

class Client {
  static async findAll() {
    const { rows } = await pool.query(`${SELECT_CLIENT} ORDER BY c.id`);
    return rows;
  }

  static async findById(id) {
    const { rows } = await pool.query(`${SELECT_CLIENT} WHERE c.id = $1`, [id]);
    return rows[0] ?? null;
  }

  // Vue détaillée : json_build_object construit les objets imbriqués directement en SQL.
  static async findFiche(id) {
    const client = await Client.findById(id);
    if (!client) return null;

    const { rows } = await pool.query(
      `SELECT a.id, a.statut, a.date_debut, a.date_fin,
              a.prix_applique::float AS prix_applique,
              json_build_object(
                'id', o.id, 'nom', o.nom, 'categorie', o.categorie
              ) AS offre,
              CASE WHEN s.id IS NULL THEN NULL ELSE json_build_object(
                'id', s.id, 'nom_hote', s.nom_hote, 'adresse_ip', s.adresse_ip,
                'statut', s.statut,
                'datacenter', json_build_object('id', d.id, 'nom', d.nom, 'ville', d.ville)
              ) END AS serveur
       FROM abonnement a
       JOIN offre o           ON o.id = a.offre_id
       LEFT JOIN serveur s    ON s.id = a.serveur_id
       LEFT JOIN datacenter d ON d.id = s.datacenter_id
       WHERE a.client_id = $1
       ORDER BY a.date_debut DESC, a.id DESC`,
      [id],
    );

    return { ...client, abonnements: rows };
  }

  // Deux INSERT liés (client + sous-type) : transaction pour ne jamais en garder un seul.
  static async createOne({ type, email, tel, nom, siret, raison_sociale }) {
    const db = await pool.connect();
    try {
      await db.query("BEGIN");

      const { rows } = await db.query(
        "INSERT INTO client (type, email, tel) VALUES ($1, $2, $3) RETURNING *",
        [type, email, tel ?? null],
      );
      const client = rows[0];

      if (type === "PARTICULIER") {
        await db.query(
          "INSERT INTO particulier (client_id, nom) VALUES ($1, $2)",
          [client.id, nom],
        );
      } else {
        await db.query(
          "INSERT INTO entreprise (client_id, siret, raison_sociale) VALUES ($1, $2, $3)",
          [client.id, siret, raison_sociale],
        );
      }

      await db.query("COMMIT");
      return Client.findById(client.id);
    } catch (error) {
      await db.query("ROLLBACK");
      throw error;
    } finally {
      db.release();
    }
  }
}

module.exports = Client;
