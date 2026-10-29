// Connexion PostgreSQL partagée par tous les modèles SQL.
// Un Pool garde plusieurs connexions ouvertes et les réutilise : bien plus rapide
// que d'ouvrir une connexion à chaque requête.

const { Pool, types } = require("pg");

// Par défaut pg convertit les colonnes DATE en objet Date JS (avec décalage horaire).
// On garde la chaîne brute "AAAA-MM-JJ" renvoyée par PostgreSQL.
types.setTypeParser(types.builtins.DATE, (value) => value);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

module.exports = pool;
