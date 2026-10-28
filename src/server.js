require("dotenv").config();
const express = require("express");

const ticketRoutes = require("./routes/ticket.routes");
const serveurRoutes = require("./routes/serveur.routes");
const abonnementRoutes = require("./routes/abonnement.routes");
const catalogueRoutes = require("./routes/catalogue.routes");
const dashboardRoutes = require("./routes/dashboard.routes");
const technicienRoutes = require("./routes/technicien.routes");
const clientRoutes = require("./routes/client.route");
const datacenterRoutes = require("./routes/datacenter.routes");

const pool = require("./db");
const connectMongo = require("./config/mongo");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.use("/api", ticketRoutes);
app.use("/api", serveurRoutes);
app.use("/api", abonnementRoutes);
app.use("/api", catalogueRoutes);
app.use("/api/clients", clientRoutes);
app.use("/api/datacenters", datacenterRoutes);
app.use("/api", dashboardRoutes);
app.use("/api", technicienRoutes);

app.use((req, res) => {
  res.status(404).json({ error: "Route introuvable." });
});


app.use((error, req, res, next) => {
  if (error.type === "entity.parse.failed") {
    return res.status(400).json({ error: "JSON invalide." });
  }
  if (error.status) {
    return res.status(error.status).json({ error: error.message });
  }
  if (error.code === "22P02") {
    return res.status(400).json({ error: "Donnée invalide." });
  }
  if (error.name === "ValidationError") {
    const details = Object.values(error.errors).map((e) => e.message);
    return res.status(422).json({ error: "Document invalide.", details });
  }
  if (error.name === "CastError") {
    return res.status(400).json({ error: `Valeur invalide pour ${error.path}.` });
  }
  if (error.code === 11000) {
    return res.status(409).json({ error: "Ce document existe déjà." });
  }
  console.error(error);
  res.status(500).json({ error: "Erreur interne du serveur." });
});

const start = async () => {
  try {
    await pool.query("SELECT 1");
    console.log("Connecté à PostgreSQL");
    await connectMongo();
  } catch (error) {
    console.error("Connexion impossible :", error.message);
    process.exit(1);
  }
  app.listen(PORT, () => {
    console.log(`Serveur PaLeonis démarré sur http://localhost:${PORT}`);
  });
};

start();
