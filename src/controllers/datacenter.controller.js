const Datacenter = require("../models/datacenter.model");

const listDatacenters = async (req, res) => {
  try {
    const datacenters = await Datacenter.findAll();
    return res.status(200).json(datacenters);
  } catch (error) {
    return res.status(500).json({ error: "Erreur interne du serveur." });
  }
};

const getDatacenter = async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: "Identifiant invalide." });
  }
  try {
    const datacenter = await Datacenter.findById(id);
    if (!datacenter) {
      return res.status(404).json({ error: "Datacenter introuvable." });
    }
    return res.status(200).json(datacenter);
  } catch (error) {
    return res.status(500).json({ error: "Erreur interne du serveur." });
  }
};

module.exports = { listDatacenters, getDatacenter };
