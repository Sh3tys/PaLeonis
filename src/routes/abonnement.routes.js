// Routes : associe chaque URL + méthode HTTP à une fonction du contrôleur. Aucune logique ici.

const express = require("express");
const {
  listAbonnements,
  getAbonnement,
  createAbonnement,
  resilierAbonnement,
} = require("../controllers/abonnement.controller");

const router = express.Router();

router.get("/abonnements", listAbonnements);
router.get("/abonnements/:id", getAbonnement);

// Souscription : attribue automatiquement un serveur libre du datacenter demandé.
router.post("/abonnements", createAbonnement);

// Résiliation : PATCH car on modifie l'état, on ne supprime pas la ligne.
router.patch("/abonnements/:id/resiliation", resilierAbonnement);

module.exports = router;
