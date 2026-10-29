// Contrôleur : lit la requête (params, query, body), appelle le modèle, choisit le code HTTP.
// Pas de SQL ici. Les erreurs non gérées remontent au gestionnaire central de server.js.

const Ticket = require("../models/ticket.model");
const Message = require("../models/message.model");

const createTicket = async (req, res) => {
  const { clientId, serveurId, sujet, description, priorite } = req.body ?? {};
  if (!clientId || !sujet || !description) {
    return res.status(400).json({ error: "clientId, sujet et description sont obligatoires." });
  }
  try {
    res.status(201).json(await Ticket.create(clientId, serveurId, sujet, description, priorite));
  } catch (error) {
    // PostgreSQL : clé étrangère invalide (l'id référencé n'existe pas).
    if (error.code === "23503") return res.status(404).json({ error: "Client ou serveur introuvable." });
    if (error.code === "22P02") return res.status(400).json({ error: "Donnée invalide." });
    throw error;
  }
};

// Le ticket (PostgreSQL) et tout son fil de messages (MongoDB) en une seule réponse.
const getTicket = async (req, res) => {
  const ticket = await Ticket.findById(req.params.id);
  if (!ticket) return res.status(404).json({ error: "Ticket introuvable." });
  res.status(200).json({ ...ticket.toJSON(), messages: await Message.filDuTicket(ticket.id) });
};

// Règles métier avant écriture : ticket ouvert, auteur valide, et un client
// ne peut écrire que sur son propre ticket.
const addMessage = async (req, res) => {
  const ticket = await Ticket.findById(req.params.id);
  if (!ticket) return res.status(404).json({ error: "Ticket introuvable." });
  if (ticket.statut === "FERME") {
    return res.status(409).json({ error: "Ticket fermé : il n'accepte plus de messages." });
  }
  const { auteur, contenu, piecesJointes } = req.body ?? {};
  if (!auteur || !["CLIENT", "TECHNICIEN"].includes(auteur.type) || !Number.isInteger(auteur.id)) {
    return res.status(422).json({ error: "auteur doit valoir { type: CLIENT | TECHNICIEN, id: entier }." });
  }
  if (auteur.type === "CLIENT" && auteur.id !== ticket.clientId) {
    return res.status(403).json({ error: "Seul le client du ticket peut y écrire." });
  }
  if (auteur.type === "TECHNICIEN" && !(await Ticket.technicienExists(auteur.id))) {
    return res.status(404).json({ error: "Technicien introuvable." });
  }
  const message = await Message.create({ ticketId: ticket.id, auteur, contenu, piecesJointes });
  res.status(201).json(message);
};

// Cascade manuelle : PostgreSQL d'abord, puis le fil de messages MongoDB.
const deleteTicket = async (req, res) => {
  if (!(await Ticket.deleteOne(req.params.id))) {
    return res.status(404).json({ error: "Ticket introuvable." });
  }
  await Message.deleteMany({ ticketId: Number(req.params.id) });
  res.status(204).end();
};

const assignTicket = async (req, res) => {
  const { technicienId } = req.body ?? {};
  if (!technicienId) return res.status(400).json({ error: "technicienId est obligatoire." });
  try {
    const ticket = await Ticket.assign(req.params.id, technicienId);
    if (!ticket) return res.status(404).json({ error: "Ticket introuvable." });
    res.status(200).json(ticket);
  } catch (error) {
    if (error.code === "23503") return res.status(404).json({ error: "Technicien introuvable." });
    throw error;
  }
};

const updateTicketStatut = async (req, res) => {
  const { statut } = req.body ?? {};
  const ticket = await Ticket.findById(req.params.id);
  if (!ticket) return res.status(404).json({ error: "Ticket introuvable." });
  if (!ticket.peutPasserA(statut)) {
    return res.status(400).json({ error: `Transition ${ticket.statut} vers ${statut} impossible.` });
  }
  res.status(200).json(await Ticket.updateStatut(req.params.id, statut));
};

const listTicketsTechnicien = async (req, res) => {
  if (!(await Ticket.technicienExists(req.params.id))) {
    return res.status(404).json({ error: "Technicien introuvable." });
  }
  res.status(200).json(await Ticket.findOpenByTechnicien(req.params.id));
};

module.exports = {
  createTicket,
  getTicket,
  addMessage,
  deleteTicket,
  assignTicket,
  updateTicketStatut,
  listTicketsTechnicien,
};
