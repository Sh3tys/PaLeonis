// Contrôleur : lit la requête (params, query, body), appelle le modèle, choisit le code HTTP.
// Pas de SQL ici. Les erreurs non gérées remontent au gestionnaire central de server.js.

const Dashboard = require("../models/dashboard.model");

const getRevenus = async (req, res) => {
  res.status(200).json(await Dashboard.revenus());
};

const getServeurs = async (req, res) => {
  res.status(200).json(await Dashboard.serveurs());
};

module.exports = { getRevenus, getServeurs };
