// Modèle SQL : seul endroit qui écrit des requêtes vers PostgreSQL pour cette table.

const pool = require("../db");

// Champs privés (#) + getters : l'objet est en lecture seule depuis l'extérieur.
class Ticket {
  #id;
  #clientId;
  #technicienId;
  #serveurId;
  #sujet;
  #description;
  #dateOuverture;
  #priorite;
  #statut;

  // Machine à états : pour chaque statut, les statuts suivants autorisés.
  static #TRANSITIONS = {
    OUVERT: ["EN_COURS"],
    EN_COURS: ["RESOLU"],
    RESOLU: ["EN_COURS", "FERME"],
    FERME: [],
  };

  constructor({ id, clientId, technicienId, serveurId, sujet, description, dateOuverture, priorite, statut }) {
    this.#id = id;
    this.#clientId = clientId;
    this.#technicienId = technicienId;
    this.#serveurId = serveurId;
    this.#sujet = sujet;
    this.#description = description;
    this.#dateOuverture = dateOuverture;
    this.#priorite = priorite;
    this.#statut = statut;
  }

  get id() {
    return this.#id;
  }

  get clientId() {
    return this.#clientId;
  }

  set clientId(clientId) {
    this.#clientId = clientId;
  }

  get technicienId() {
    return this.#technicienId;
  }

  set technicienId(technicienId) {
    this.#technicienId = technicienId;
  }

  get serveurId() {
    return this.#serveurId;
  }

  set serveurId(serveurId) {
    this.#serveurId = serveurId;
  }

  get sujet() {
    return this.#sujet;
  }

  set sujet(sujet) {
    this.#sujet = sujet;
  }

  get description() {
    return this.#description;
  }

  set description(description) {
    this.#description = description;
  }

  get dateOuverture() {
    return this.#dateOuverture;
  }

  set dateOuverture(dateOuverture) {
    this.#dateOuverture = dateOuverture;
  }

  get priorite() {
    return this.#priorite;
  }

  set priorite(priorite) {
    this.#priorite = priorite;
  }

  get statut() {
    return this.#statut;
  }

  set statut(statut) {
    this.#statut = statut;
  }

  // Règle métier portée par l'objet : le contrôleur demande, le modèle décide.
  peutPasserA(statut) {
    return Ticket.#TRANSITIONS[this.#statut].includes(statut);
  }

  // Appelé automatiquement par res.json() : définit la forme exacte renvoyée par l'API.
  toJSON() {
    return {
      id: this.#id,
      clientId: this.#clientId,
      technicienId: this.#technicienId,
      serveurId: this.#serveurId,
      sujet: this.#sujet,
      description: this.#description,
      dateOuverture: this.#dateOuverture,
      priorite: this.#priorite,
      statut: this.#statut,
    };
  }

  // Convertit une ligne SQL (snake_case) en instance du modèle.
  static #fromRow(row) {
    return new Ticket({
      id: row.id,
      clientId: row.client_id,
      technicienId: row.technicien_id,
      serveurId: row.serveur_id,
      sujet: row.sujet,
      description: row.description,
      dateOuverture: row.date_ouverture,
      priorite: row.priorite,
      statut: row.statut,
    });
  }

  // COALESCE applique la priorité NORMALE si aucune n'est fournie.
  static async create(clientId, serveurId, sujet, description, priorite) {
    const { rows } = await pool.query(
      `INSERT INTO ticket (client_id, serveur_id, sujet, description, priorite)
       VALUES ($1, $2, $3, $4, COALESCE($5::priorite_ticket, 'NORMALE'))
       RETURNING *`,
      [clientId, serveurId, sujet, description, priorite]
    );
    return Ticket.#fromRow(rows[0]);
  }

  static async findById(id) {
    const { rows } = await pool.query("SELECT * FROM ticket WHERE id = $1", [id]);
    return rows[0] ? Ticket.#fromRow(rows[0]) : null;
  }

  static async assign(id, technicienId) {
    const { rows } = await pool.query(
      "UPDATE ticket SET technicien_id = $2 WHERE id = $1 RETURNING *",
      [id, technicienId]
    );
    return rows[0] ? Ticket.#fromRow(rows[0]) : null;
  }

  static async updateStatut(id, statut) {
    const { rows } = await pool.query(
      "UPDATE ticket SET statut = $2 WHERE id = $1 RETURNING *",
      [id, statut]
    );
    return Ticket.#fromRow(rows[0]);
  }

  static async deleteOne(id) {
    const { rowCount } = await pool.query("DELETE FROM ticket WHERE id = $1", [id]);
    return rowCount > 0;
  }

  static async technicienExists(technicienId) {
    const { rows } = await pool.query("SELECT 1 FROM technicien WHERE id = $1", [technicienId]);
    return rows.length > 0;
  }

  static async findOpenByTechnicien(technicienId) {
    const { rows } = await pool.query(
      `SELECT * FROM ticket
       WHERE technicien_id = $1 AND statut <> 'FERME'
       ORDER BY priorite DESC, date_ouverture`,
      [technicienId]
    );
    return rows.map(Ticket.#fromRow);
  }
}

module.exports = Ticket;
