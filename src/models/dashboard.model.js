// Modèle SQL de statistiques : agrégations (SUM, COUNT, GROUP BY) calculées par PostgreSQL.
// ::float / ::int convertissent les résultats pour que pg renvoie des nombres et non des chaînes.

const pool = require("../db");

class Dashboard {
  static async revenus() {
    const total = await pool.query(
      `SELECT COALESCE(SUM(prix_applique), 0)::float AS total
       FROM abonnement
       WHERE statut = 'ACTIF'`
    );
    const parCategorie = await pool.query(
      `SELECT o.categorie, SUM(a.prix_applique)::float AS total
       FROM abonnement a
       JOIN offre o ON o.id = a.offre_id
       WHERE a.statut = 'ACTIF'
       GROUP BY o.categorie
       ORDER BY total DESC`
    );
    return { total: total.rows[0].total, parCategorie: parCategorie.rows };
  }

  static async serveurs() {
    const { rows } = await pool.query(
      `SELECT d.nom AS datacenter, s.statut, COUNT(*)::int AS nombre
       FROM serveur s
       JOIN datacenter d ON d.id = s.datacenter_id
       GROUP BY d.nom, s.statut
       ORDER BY d.nom, s.statut`
    );
    return rows;
  }
}

module.exports = Dashboard;
