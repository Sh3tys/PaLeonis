// Contrôleur : lit la requête (params, query, body), appelle le modèle, choisit le code HTTP.
// Pas de SQL ici. Les erreurs non gérées remontent au gestionnaire central de server.js.

const Catalogue = require("../models/catalogue.model");
const FicheTechnique = require("../models/ficheTechnique.model");

const listCatalogues = async (req, res) => {
  const { categorie, en_vente } = req.query;
  return res.status(200).json(await Catalogue.findAll(categorie, en_vente));
};

// Réponse qui combine les deux bases : l'offre (PostgreSQL) + sa fiche (MongoDB).
const getCatalogue = async (req, res) => {
  const catalogue = await Catalogue.findById(req.params.id);
  if (!catalogue) {
    return res.status(404).json({ error: "Offre introuvable." });
  }
  const fiche = await FicheTechnique.findByOffre(catalogue.id);
  return res.status(200).json({ ...catalogue.toJSON(), fiche_technique: fiche });
};

const createCatalogue = async (req, res) => {
  const catalogue = await Catalogue.createOne(req.body);
  return res.status(201).json(catalogue);
};

const updateCatalogue = async (req, res) => {
  const avant = await Catalogue.findById(req.params.id);
  if (!avant) {
    return res.status(404).json({ error: "Offre introuvable." });
  }
  const updatedCatalogue = await Catalogue.updateOne(req.params.id, req.body);
  // La forme de la fiche dépend de la catégorie : si elle change, l'ancienne fiche est invalide.
  if (updatedCatalogue.categorie !== avant.categorie) {
    await FicheTechnique.deleteOne({ offreId: updatedCatalogue.id });
  }
  return res.status(200).json(updatedCatalogue);
};

const retirerCatalogue = async (req, res) => {
  const catalogue = await Catalogue.retirer(req.params.id);
  if (!catalogue) {
    return res.status(404).json({ error: "Offre introuvable." });
  }
  return res.status(200).json(catalogue);
};

// Pas de clé étrangère entre les deux bases : la cascade est faite à la main.
// PostgreSQL d'abord (il peut refuser si l'offre est utilisée), puis MongoDB.
const deleteCatalogue = async (req, res) => {
  const supprimee = await Catalogue.deleteOne(req.params.id);
  if (!supprimee) {
    return res.status(404).json({ error: "Offre introuvable." });
  }
  await FicheTechnique.deleteOne({ offreId: Number(req.params.id) });
  return res.status(204).end();
};

const getFiche = async (req, res) => {
  const catalogue = await Catalogue.findById(req.params.id);
  if (!catalogue) {
    return res.status(404).json({ error: "Offre introuvable." });
  }
  const fiche = await FicheTechnique.findByOffre(catalogue.id);
  if (!fiche) {
    return res.status(404).json({ error: "Cette offre n'a pas encore de fiche technique." });
  }
  return res.status(200).json(fiche);
};

// La catégorie vient de PostgreSQL : c'est elle qui choisit le schéma de la fiche.
// 201 si la fiche vient d'être créée, 200 si elle a été remplacée.
const putFiche = async (req, res) => {
  const catalogue = await Catalogue.findById(req.params.id);
  if (!catalogue) {
    return res.status(404).json({ error: "Offre introuvable." });
  }
  const { fiche, creee } = await FicheTechnique.remplacer(
    catalogue.id,
    catalogue.categorie,
    req.body,
  );
  return res.status(creee ? 201 : 200).json(fiche);
};

// Recherche plein texte dans MongoDB, puis on renvoie les offres correspondantes depuis PostgreSQL.
const rechercherFiches = async (req, res) => {
  const { q } = req.query;
  if (typeof q !== "string" || q.trim() === "") {
    return res.status(400).json({ error: "Le paramètre q est obligatoire." });
  }
  const offreIds = await FicheTechnique.rechercher(q);
  return res.status(200).json(await Catalogue.findByIds(offreIds));
};

module.exports = {
  listCatalogues,
  getCatalogue,
  createCatalogue,
  updateCatalogue,
  retirerCatalogue,
  deleteCatalogue,
  getFiche,
  putFiche,
  rechercherFiches,
};
