const express = require("express");
const {
  listDatacenters,
  getDatacenter,
} = require("../controllers/datacenter.controller");

const router = express.Router();

router.get("/", listDatacenters);
router.get("/:id", getDatacenter);

module.exports = router;
