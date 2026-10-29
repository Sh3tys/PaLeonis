// Modèle MongoDB (Mongoose) : le schéma valide chaque document avant écriture.
// Journal d'activité des serveurs : beaucoup d'écritures, aucune modification.
// Discriminators = une seule collection, mais un schéma différent par type d'événement.

const { Schema, model } = require("mongoose");

const TYPES = ["REDEMARRAGE", "ALERTE", "MAINTENANCE", "METRIQUE"];
const NIVEAUX = ["INFO", "AVERTISSEMENT", "CRITIQUE"];
// En secondes, comme l'attend l'option expireAfterSeconds.
const QUATRE_VINGT_DIX_JOURS = 90 * 24 * 60 * 60;

// Crée une erreur portant un code HTTP : server.js la renverra telle quelle au client.
const httpError = (status, message) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

const evenementSchema = new Schema(
  {
    // Id du serveur dans PostgreSQL.
    serveurId: { type: Number, required: true },
    date: { type: Date, default: Date.now },
  },
  {
    // Le champ "type" indique quel sous-schéma s'applique au document.
    discriminatorKey: "type",
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false,
  },
);

// Lecture typique : les événements d'un serveur, du plus récent au plus ancien.
evenementSchema.index({ serveurId: 1, date: -1 });
// Index TTL partiel : MongoDB supprime seul les METRIQUE de plus de 90 jours.
evenementSchema.index(
  { date: 1 },
  { expireAfterSeconds: QUATRE_VINGT_DIX_JOURS, partialFilterExpression: { type: "METRIQUE" } },
);

const Evenement = model("Evenement", evenementSchema, "evenements");

// Un sous-schéma par type : champs propres à ce type d'événement.
Evenement.discriminator(
  "REDEMARRAGE",
  new Schema({
    motif: { type: String, required: true, trim: true, maxlength: 300 },
    planifie: { type: Boolean, default: false },
    dureeSecondes: { type: Number, min: 0 },
  }),
);

Evenement.discriminator(
  "ALERTE",
  new Schema({
    niveau: { type: String, enum: NIVEAUX, required: true },
    message: { type: String, required: true, trim: true, maxlength: 500 },
  }),
);

Evenement.discriminator(
  "MAINTENANCE",
  new Schema({
    technicienId: { type: Number },
    description: { type: String, required: true, trim: true, maxlength: 1000 },
    dureeMinutes: { type: Number, min: 0 },
  }),
);

// Définition de champ réutilisée pour cpu, ram et disque.
const pourcentage = { type: Number, required: true, min: 0, max: 100 };
Evenement.discriminator(
  "METRIQUE",
  new Schema({ cpu: pourcentage, ram: pourcentage, disque: pourcentage }),
);

const parseDate = (value, nom) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw httpError(400, `${nom} n'est pas une date valide.`);
  return date;
};

// Méthodes ajoutées au modèle : le contrôleur les appelle sans écrire de requête Mongo.
// On écarte _id/createdAt fournis par le client, puis on crée via le bon sous-schéma.
Evenement.enregistrer = async (serveurId, dto) => {
  const { _id, createdAt, ...data } = dto ?? {};
  if (!TYPES.includes(data.type)) {
    throw httpError(422, `Le type doit être l'un de : ${TYPES.join(", ")}.`);
  }
  return Evenement.discriminators[data.type].create({ ...data, serveurId });
};

Evenement.lister = async (serveurId, { type, debut, fin, limite }) => {
  const filtre = { serveurId };
  if (type !== undefined) {
    if (!TYPES.includes(type)) {
      throw httpError(400, `Le type doit être l'un de : ${TYPES.join(", ")}.`);
    }
    filtre.type = type;
  }
  if (debut !== undefined || fin !== undefined) {
    filtre.date = {};
    if (debut !== undefined) filtre.date.$gte = parseDate(debut, "debut");
    if (fin !== undefined) filtre.date.$lte = parseDate(fin, "fin");
  }
  const max = limite === undefined ? 50 : Number(limite);
  if (!Number.isInteger(max) || max < 1 || max > 500) {
    throw httpError(400, "limite doit être un entier entre 1 et 500.");
  }
  return Evenement.find(filtre).sort({ date: -1 }).limit(max);
};

// Pipeline d'agrégation : MongoDB calcule le nombre d'événements par type.
Evenement.statistiques = (serveurId) =>
  Evenement.aggregate([
    { $match: { serveurId } },
    { $group: { _id: "$type", total: { $sum: 1 }, dernier: { $max: "$date" } } },
    { $project: { _id: 0, type: "$_id", total: 1, dernier: 1 } },
    { $sort: { total: -1 } },
  ]);

// Alertes par jour et par serveur sur 7 jours, en un seul pipeline.
Evenement.alertesParJour = () =>
  Evenement.aggregate([
    {
      $match: {
        type: "ALERTE",
        date: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
    },
    {
      $group: {
        _id: {
          serveurId: "$serveurId",
          jour: { $dateToString: { format: "%Y-%m-%d", date: "$date", timezone: "Europe/Paris" } },
        },
        total: { $sum: 1 },
      },
    },
    { $project: { _id: 0, serveurId: "$_id.serveurId", jour: "$_id.jour", total: 1 } },
    { $sort: { jour: -1, serveurId: 1 } },
  ]);

Evenement.TYPES = TYPES;

module.exports = Evenement;
