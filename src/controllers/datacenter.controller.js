// Contrôleur : lit la requête (params, query, body), appelle le modèle, choisit le code HTTP.
// Pas de SQL ici. Les erreurs non gérées remontent au gestionnaire central de server.js.

const Datacenter = require("../models/datacenter.model");

const listDatacenters = async (req, res) => {
  try {
    const datacenters = await Datacenter.findAll();
    return res.status(200).json(datacenters);
  } catch (error) {
    return res.status(500).json({ error: "Erreur interne du serveur." });
  }
};

const getDatacenter = async (req, res) => {
  const id = Number(req.params.id);
  // Refuse tôt un id mal formé plutôt que d'interroger la base.
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: "Identifiant invalide." });
  }
  try {
    const datacenter = await Datacenter.findById(id);
    if (!datacenter) {
      return res.status(404).json({ error: "Datacenter introuvable." });
    }
    return res.status(200).json(datacenter);
  } catch (error) {
    return res.status(500).json({ error: "Erreur interne du serveur." });
  }
};

module.exports = { listDatacenters, getDatacenter };
