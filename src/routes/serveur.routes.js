// Routes : associe chaque URL + méthode HTTP à une fonction du contrôleur. Aucune logique ici.
// Serveurs (PostgreSQL) et leur journal d'événements (MongoDB).

const express = require("express");
const {
  listServeurs,
  getServeur,
  deleteServeur,
  createEvenement,
  listEvenements,
  statsEvenements,
  alertesParJour,
} = require("../controllers/serveur.controller");

const router = express.Router();

// Route fixe déclarée avant /serveurs/:id pour ne pas être capturée par le paramètre.
router.get("/serveurs/alertes/par-jour", alertesParJour);
router.get("/serveurs/:id", getServeur);
router.get("/serveurs", listServeurs);
router.delete("/serveurs/:id", deleteServeur);

// Journal d'événements. Filtres de lecture : ?type=&debut=&fin=&limite=
router.post("/serveurs/:id/evenements", createEvenement);
router.get("/serveurs/:id/evenements", listEvenements);
router.get("/serveurs/:id/evenements/stats", statsEvenements);

module.exports = router;
