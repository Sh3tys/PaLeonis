// Contrôleur : lit la requête (params, query, body), appelle le modèle, choisit le code HTTP.
// Pas de SQL ici. Les erreurs non gérées remontent au gestionnaire central de server.js.

const Serveur = require("../models/serveur.model");
const Technicien = require("../models/technicien.model");
const Evenement = require("../models/evenement.model");

const listServeurs = async (req, res) => {
  const { datacenter, statut, attribue } = req.query;
  res.status(200).json(await Serveur.findAll(datacenter, statut, attribue));
};

const getServeur = async (req, res) => {
  const serveur = await Serveur.findById(req.params.id);
  if (!serveur) return res.status(404).json({ error: "Serveur introuvable." });
  res.status(200).json(serveur);
};

// Interdit si le serveur est attribué. Cascade manuelle : PostgreSQL puis le journal MongoDB.
const deleteServeur = async (req, res) => {
  const serveur = await Serveur.findById(req.params.id);
  if (!serveur) return res.status(404).json({ error: "Serveur introuvable." });
  if (serveur.attribue) {
    return res.status(409).json({ error: "Serveur attribué à un abonnement." });
  }
  await Serveur.deleteOne(serveur.id);
  await Evenement.deleteMany({ serveurId: serveur.id });
  res.status(204).end();
};

// On vérifie dans PostgreSQL que le serveur (et le technicien éventuel) existe
// avant d'écrire dans MongoDB, qui ne connaît pas ces tables.
const createEvenement = async (req, res) => {
  const serveur = await Serveur.findById(req.params.id);
  if (!serveur) return res.status(404).json({ error: "Serveur introuvable." });
  const { technicienId } = req.body ?? {};
  if (technicienId !== undefined && !(await Technicien.findById(technicienId))) {
    return res.status(404).json({ error: "Technicien introuvable." });
  }
  res.status(201).json(await Evenement.enregistrer(serveur.id, req.body));
};

const listEvenements = async (req, res) => {
  const serveur = await Serveur.findById(req.params.id);
  if (!serveur) return res.status(404).json({ error: "Serveur introuvable." });
  res.status(200).json(await Evenement.lister(serveur.id, req.query));
};

const statsEvenements = async (req, res) => {
  const serveur = await Serveur.findById(req.params.id);
  if (!serveur) return res.status(404).json({ error: "Serveur introuvable." });
  res.status(200).json({ serveurId: serveur.id, parType: await Evenement.statistiques(serveur.id) });
};

const alertesParJour = async (req, res) => {
  res.status(200).json(await Evenement.alertesParJour());
};

module.exports = {
  listServeurs,
  getServeur,
  deleteServeur,
  createEvenement,
  listEvenements,
  statsEvenements,
  alertesParJour,
};
