// Routes : associe chaque URL + méthode HTTP à une fonction du contrôleur. Aucune logique ici.

const express = require("express");
const { listTechniciens, getTechnicien } = require("../controllers/technicien.controller");

const router = express.Router();

router.get("/techniciens/:id", getTechnicien);
router.get("/techniciens", listTechniciens);

module.exports = router;
