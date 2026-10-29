// Contrôleur : lit la requête (params, query, body), appelle le modèle, choisit le code HTTP.
// Pas de SQL ici. Les erreurs non gérées remontent au gestionnaire central de server.js.
// La validation et la transaction de souscription sont dans le modèle.

const Abonnement = require("../models/abonnement.model");

const listAbonnements = async (req, res) => {
  return res.status(200).json(await Abonnement.findAll());
};

const getAbonnement = async (req, res) => {
  const abonnement = await Abonnement.findById(req.params.id);
  if (!abonnement) {
    return res.status(404).json({ error: "Abonnement introuvable." });
  }
  return res.status(200).json(abonnement);
};

const createAbonnement = async (req, res) => {
  const abonnement = await Abonnement.createOne(req.body);
  return res.status(201).json(abonnement);
};

const resilierAbonnement = async (req, res) => {
  const abonnement = await Abonnement.resilier(req.params.id);
  if (!abonnement) {
    return res.status(404).json({ error: "Abonnement introuvable." });
  }
  return res.status(200).json(abonnement);
};

module.exports = {
  listAbonnements,
  getAbonnement,
  createAbonnement,
  resilierAbonnement,
};
