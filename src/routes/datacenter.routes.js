// Routes : associe chaque URL + méthode HTTP à une fonction du contrôleur. Aucune logique ici.
// Monté sur /api/datacenters dans server.js.

const express = require("express");
const {
  listDatacenters,
  getDatacenter,
} = require("../controllers/datacenter.controller");

const router = express.Router();

router.get("/", listDatacenters);
router.get("/:id", getDatacenter);

module.exports = router;
