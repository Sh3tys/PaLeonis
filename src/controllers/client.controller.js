// Contrôleur : lit la requête (params, query, body), appelle le modèle, choisit le code HTTP.
// Pas de SQL ici. Les erreurs non gérées remontent au gestionnaire central de server.js.
// Variante : ici la validation et le try/catch sont faits dans le contrôleur.

const Client = require("../models/client.model");

// Doit rester aligné avec l'ENUM type_client de database/schema.sql.
const TYPES = ["PARTICULIER", "ENTREPRISE"];

const listClients = async (req, res) => {
  try {
    const clients = await Client.findAll();
    return res.status(200).json(clients);
  } catch (error) {
    return res.status(500).json({ error: "Erreur interne du serveur." });
  }
};

const getClient = async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: "Identifiant invalide." });
  }
  try {
    const client = await Client.findById(id);
    if (!client) {
      return res.status(404).json({ error: "Client introuvable." });
    }
    return res.status(200).json(client);
  } catch (error) {
    return res.status(500).json({ error: "Erreur interne du serveur." });
  }
};

const getFicheClient = async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: "Identifiant invalide." });
  }
  try {
    const fiche = await Client.findFiche(id);
    if (!fiche) {
      return res.status(404).json({ error: "Client introuvable." });
    }
    return res.status(200).json(fiche);
  } catch (error) {
    return res.status(500).json({ error: "Erreur interne du serveur." });
  }
};

const createClient = async (req, res) => {
  const { type, email, nom, siret, raison_sociale } = req.body ?? {};

  if (!TYPES.includes(type)) {
    return res
      .status(400)
      .json({ error: "Le type doit être PARTICULIER ou ENTREPRISE." });
  }
  if (!email) {
    return res.status(400).json({ error: "L'email est obligatoire." });
  }
  if (type === "PARTICULIER" && !nom) {
    return res
      .status(400)
      .json({ error: "Le nom est obligatoire pour un particulier." });
  }
  if (type === "ENTREPRISE" && (!siret || !raison_sociale)) {
    return res.status(400).json({
      error:
        "Le siret et la raison sociale sont obligatoires pour une entreprise.",
    });
  }

  try {
    const client = await Client.createOne(req.body);
    return res.status(201).json(client);
  } catch (error) {
    // PostgreSQL : violation d'unicité (email ou siret déjà utilisé).
    if (error.code === "23505") {
      return res
        .status(409)
        .json({ error: "Un client avec ces informations existe déjà." });
    }
    return res.status(400).json({ error: error.message });
  }
};

module.exports = { listClients, getClient, createClient, getFicheClient };
