// Routes : associe chaque URL + méthode HTTP à une fonction du contrôleur. Aucune logique ici.
// Monté sur /api/clients dans server.js, d'où les chemins relatifs ("/", "/:id").

const express = require("express");
const {
  listClients,
  getClient,
  createClient,
  getFicheClient,
} = require("../controllers/client.controller");

const router = express.Router();

router.get("/", listClients);
// Fiche complète : client + abonnements + serveurs. Déclarée avant /:id par lisibilité.
router.get("/:id/fiche", getFicheClient);
router.get("/:id", getClient);
router.post("/", createClient);

module.exports = router;
