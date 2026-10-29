// Modèle MongoDB (Mongoose) : le schéma valide chaque document avant écriture.
// Fiche technique d'une offre : sa structure dépend de la catégorie, d'où MongoDB
// et un discriminator (sous-schéma) par catégorie dans une seule collection.

const { Schema, model } = require("mongoose");

const ficheSchema = new Schema(
  {
    // Id de l'offre dans PostgreSQL ; unique = une seule fiche par offre.
    offreId: { type: Number, required: true, unique: true },
    // Champ libre : on peut ajouter des informations sans modifier le schéma.
    caracteristiques: { type: Schema.Types.Mixed, default: {} },
  },
  { discriminatorKey: "categorie", timestamps: true, versionKey: false },
);

// Index texte sur tous les champs : permet la recherche $text.
ficheSchema.index({ "$**": "text" });

const FicheTechnique = model("FicheTechnique", ficheSchema, "fiches_techniques");

// Un sous-schéma par catégorie d'offre.
FicheTechnique.discriminator(
  "VPS",
  new Schema({
    vcpu: { type: Number, required: true, min: 1 },
    ramGo: { type: Number, required: true, min: 1 },
    stockageGo: { type: Number, required: true, min: 1 },
    typeStockage: { type: String, enum: ["HDD", "SSD", "NVMe"], default: "SSD" },
    systeme: { type: String, required: true, trim: true },
  }),
);

FicheTechnique.discriminator(
  "HEBERGEMENT_MUTUALISE",
  new Schema({
    espaceDisqueGo: { type: Number, required: true, min: 1 },
    nbSitesMax: { type: Number, required: true, min: 1 },
    nbBasesDonnees: { type: Number, min: 0, default: 1 },
    certificatSsl: { type: Boolean, default: true },
  }),
);

FicheTechnique.discriminator(
  "SERVEUR_DEDIE",
  new Schema({
    processeur: { type: String, required: true, trim: true },
    ramGo: { type: Number, required: true, min: 1 },
    disques: {
      type: [
        {
          _id: false,
          type: { type: String, enum: ["HDD", "SSD", "NVMe"], required: true },
          capaciteGo: { type: Number, required: true, min: 1 },
        },
      ],
      validate: [(disques) => disques.length > 0, "Au moins un disque est obligatoire."],
    },
    bandePassanteMbps: { type: Number, required: true, min: 1 },
  }),
);

FicheTechnique.discriminator(
  "NOM_DE_DOMAINE",
  new Schema({
    extension: { type: String, required: true, match: /^\.[a-z0-9.-]+$/ },
    registrar: { type: String, required: true, trim: true },
    dureeEngagementMois: { type: Number, required: true, min: 1 },
  }),
);

FicheTechnique.findByOffre = (offreId) => FicheTechnique.findOne({ offreId });

// Remplace (ou crée) la fiche. Valide d'abord, pour ne pas supprimer
// l'ancienne fiche si la nouvelle est invalide.
FicheTechnique.remplacer = async (offreId, categorie, dto) => {
  const { _id, createdAt, updatedAt, ...data } = dto ?? {};
  const Fiche = FicheTechnique.discriminators[categorie];
  const fiche = new Fiche({ ...data, offreId, categorie });
  await fiche.validate();
  const { deletedCount } = await FicheTechnique.deleteOne({ offreId });
  await fiche.save();
  return { fiche, creee: deletedCount === 0 };
};

FicheTechnique.rechercher = async (texte) => {
  const fiches = await FicheTechnique.find({ $text: { $search: texte } }, { offreId: 1 });
  return fiches.map((fiche) => fiche.offreId);
};

module.exports = FicheTechnique;
