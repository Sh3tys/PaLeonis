// Routes : associe chaque URL + méthode HTTP à une fonction du contrôleur. Aucune logique ici.
// Indicateurs agrégés en lecture seule (revenus, parc de serveurs).

const express = require("express");
const { getRevenus, getServeurs } = require("../controllers/dashboard.controller");

const router = express.Router();

router.get("/dashboard/revenus", getRevenus);
router.get("/dashboard/serveurs", getServeurs);

module.exports = router;
