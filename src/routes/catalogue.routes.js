// Routes : associe chaque URL + méthode HTTP à une fonction du contrôleur. Aucune logique ici.
// Une offre vit dans PostgreSQL, sa fiche technique dans MongoDB.

const express = require("express");
const {
  listCatalogues,
  getCatalogue,
  createCatalogue,
  updateCatalogue,
  retirerCatalogue,
  deleteCatalogue,
  getFiche,
  putFiche,
  rechercherFiches,
} = require("../controllers/catalogue.controller");

const router = express.Router();

// Filtres facultatifs : ?categorie=VPS&en_vente=true
router.get("/offres", listCatalogues);
// Déclarée avant /offres/:id, sinon "recherche" serait pris pour un id. Recherche : ?q=texte
router.get("/offres/recherche", rechercherFiches);
router.get("/offres/:id", getCatalogue);

router.post("/offres", createCatalogue);
router.put("/offres/:id", updateCatalogue);
router.delete("/offres/:id", deleteCatalogue);

// Retrait de la vente sans suppression (les abonnements existants restent valides).
router.patch("/offres/:id/retrait", retirerCatalogue);

// Fiche technique (MongoDB) d'une offre. PUT crée ou remplace entièrement la fiche.
router.get("/offres/:id/fiche", getFiche);
router.put("/offres/:id/fiche", putFiche);

module.exports = router;
