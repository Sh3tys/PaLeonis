// Point d'entrée de l'API : configure Express, branche les routes, gère les erreurs,
// puis démarre le serveur une fois les deux bases (PostgreSQL et MongoDB) joignables.

// Charge le fichier .env dans process.env avant tout le reste.
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

// Transforme le corps JSON des requêtes en objet req.body.
app.use(express.json());

// Chaque ressource a son fichier de routes, monté sous le préfixe /api.
app.use("/api", ticketRoutes);
app.use("/api", serveurRoutes);
app.use("/api", abonnementRoutes);
app.use("/api", catalogueRoutes);
app.use("/api/clients", clientRoutes);
app.use("/api/datacenters", datacenterRoutes);
app.use("/api", dashboardRoutes);
app.use("/api", technicienRoutes);

// Aucune route n'a répondu : 404 en JSON plutôt que la page HTML d'Express.
app.use((req, res) => {
  res.status(404).json({ error: "Route introuvable." });
});


// Gestionnaire d'erreurs central (4 paramètres obligatoires pour Express).
// Express 5 y envoie aussi les erreurs des contrôleurs async : pas besoin de try/catch partout.
// Il traduit chaque type d'erreur connu en code HTTP propre.
app.use((error, req, res, next) => {
  // Corps de requête qui n'est pas du JSON valide.
  if (error.type === "entity.parse.failed") {
    return res.status(400).json({ error: "JSON invalide." });
  }
  // Erreur métier levée volontairement par un modèle (voir httpError).
  if (error.status) {
    return res.status(error.status).json({ error: error.message });
  }
  // PostgreSQL : valeur au mauvais format (ex. un id "abc" pour un INTEGER).
  if (error.code === "22P02") {
    return res.status(400).json({ error: "Donnée invalide." });
  }
  // Mongoose : le document ne respecte pas son schéma.
  if (error.name === "ValidationError") {
    const details = Object.values(error.errors).map((e) => e.message);
    return res.status(422).json({ error: "Document invalide.", details });
  }
  // Mongoose : valeur impossible à convertir vers le type du champ.
  if (error.name === "CastError") {
    return res.status(400).json({ error: `Valeur invalide pour ${error.path}.` });
  }
  // MongoDB : violation d'un index unique.
  if (error.code === 11000) {
    return res.status(409).json({ error: "Ce document existe déjà." });
  }
  console.error(error);
  res.status(500).json({ error: "Erreur interne du serveur." });
});

// On vérifie les connexions avant d'écouter : si une base est absente, on s'arrête net
// au lieu de démarrer une API qui échouera à chaque requête.
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
