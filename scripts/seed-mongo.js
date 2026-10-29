// Jeu d'essai MongoDB, cohérent avec les ids insérés par database/seed.sql.
// Usage : node scripts/seed-mongo.js (vide puis remplit les collections).

require("dotenv").config();
const mongoose = require("mongoose");
const FicheTechnique = require("../src/models/ficheTechnique.model");
const Evenement = require("../src/models/evenement.model");
const Message = require("../src/models/message.model");

const HEURE = 60 * 60 * 1000;
const JOUR = 24 * HEURE;
// Dates relatives à maintenant, pour que les données restent "récentes" à chaque seed.
const ilYa = (ms) => new Date(Date.now() - ms);

// Une fiche par offre (offres 1 à 5 de seed.sql).
const fiches = [
  {
    offreId: 1, categorie: "VPS",
    vcpu: 1, ramGo: 2, stockageGo: 40, typeStockage: "SSD", systeme: "Debian 12",
    caracteristiques: { ipv6: true, snapshots: 1 },
  },
  {
    offreId: 2, categorie: "VPS",
    vcpu: 4, ramGo: 8, stockageGo: 160, typeStockage: "NVMe", systeme: "Ubuntu 24.04 LTS",
    caracteristiques: { ipv6: true, snapshots: 5, sauvegardeQuotidienne: true },
  },
  {
    offreId: 3, categorie: "HEBERGEMENT_MUTUALISE",
    espaceDisqueGo: 100, nbSitesMax: 5, nbBasesDonnees: 10, certificatSsl: true,
    caracteristiques: { php: ["8.2", "8.3"], comptesMail: 10 },
  },
  {
    offreId: 4, categorie: "SERVEUR_DEDIE",
    processeur: "AMD EPYC 4344P (8 cœurs)", ramGo: 64,
    disques: [{ type: "NVMe", capaciteGo: 960 }, { type: "NVMe", capaciteGo: 960 }],
    bandePassanteMbps: 1000,
    caracteristiques: { raid: "RAID 1", ipmi: true, systeme: "Ubuntu 22.04 LTS" },
  },
  {
    offreId: 5, categorie: "NOM_DE_DOMAINE",
    extension: ".fr", registrar: "AFNIC", dureeEngagementMois: 12,
    caracteristiques: { dnssec: true, redirectionMail: true },
  },
];

// Une cinquantaine d'événements sur les serveurs 1 à 3, répartis sur 10 jours.
const evenements = [];
for (const serveurId of [1, 2, 3]) {
  for (let jour = 0; jour < 10; jour++) {
    const base = jour * JOUR + serveurId * HEURE;
    evenements.push({
      serveurId, type: "METRIQUE", date: ilYa(base),
      cpu: 20 + ((jour * 7 + serveurId * 11) % 70),
      ram: 30 + ((jour * 5 + serveurId * 13) % 60),
      disque: 40 + ((jour * 3 + serveurId) % 55),
    });
    if ((jour + serveurId) % 3 === 0) {
      evenements.push({
        serveurId, type: "ALERTE", date: ilYa(base + 2 * HEURE),
        niveau: jour % 2 === 0 ? "AVERTISSEMENT" : "CRITIQUE",
        message: jour % 2 === 0 ? "Charge CPU supérieure à 85 %" : "Disque /var rempli à 95 %",
      });
    }
    if ((jour + serveurId) % 4 === 0) {
      evenements.push({
        serveurId, type: "REDEMARRAGE", date: ilYa(base + 3 * HEURE),
        motif: jour % 2 === 0 ? "Mise à jour du noyau" : "Service SSH bloqué",
        planifie: jour % 2 === 0, dureeSecondes: 90 + jour * 10,
      });
    }
  }
}
evenements.push(
  {
    serveurId: 2, type: "MAINTENANCE", date: ilYa(2 * JOUR), technicienId: 1,
    description: "Remplacement d'une barrette mémoire défectueuse", dureeMinutes: 45,
  },
  {
    serveurId: 3, type: "MAINTENANCE", date: ilYa(5 * JOUR), technicienId: 2,
    description: "Mise à jour du firmware RAID", dureeMinutes: 30,
  },
  {
    serveurId: 1, type: "MAINTENANCE", date: ilYa(8 * JOUR), technicienId: 1,
    description: "Nettoyage des journaux et rotation logrotate", dureeMinutes: 15,
  },
);

// Fils de messages des tickets 1 et 2.
const messages = [
  { ticketId: 1, auteur: { type: "CLIENT", id: 1 }, createdAt: ilYa(5 * HEURE),
    contenu: "Bonjour, mon serveur ne répond plus en SSH depuis ce matin." },
  { ticketId: 1, auteur: { type: "TECHNICIEN", id: 1 }, createdAt: ilYa(4 * HEURE),
    contenu: "Bonjour, je regarde. Pouvez-vous m'envoyer le message d'erreur exact ?" },
  { ticketId: 1, auteur: { type: "CLIENT", id: 1 }, createdAt: ilYa(3 * HEURE),
    contenu: "Voici la capture.",
    piecesJointes: [{ nom: "erreur-ssh.png", url: "https://files.paleonis.fr/tickets/1/erreur-ssh.png" }] },
  { ticketId: 1, auteur: { type: "TECHNICIEN", id: 1 }, createdAt: ilYa(2 * HEURE),
    contenu: "Le service sshd était bloqué, je l'ai redémarré. Pouvez-vous réessayer ?",
    piecesJointes: [{ nom: "journal-sshd.txt", url: "https://files.paleonis.fr/tickets/1/journal-sshd.txt" }] },
  { ticketId: 2, auteur: { type: "CLIENT", id: 2 }, createdAt: ilYa(26 * HEURE),
    contenu: "Bonjour, nous souhaitons recevoir nos factures au nom d'ACME SAS." },
  { ticketId: 2, auteur: { type: "TECHNICIEN", id: 2 }, createdAt: ilYa(25 * HEURE),
    contenu: "Bonjour, c'est noté. Pouvez-vous nous confirmer l'adresse de facturation ?" },
  { ticketId: 2, auteur: { type: "CLIENT", id: 2 }, createdAt: ilYa(24 * HEURE),
    contenu: "12 rue de la Paix, 75002 Paris. Kbis en pièce jointe.",
    piecesJointes: [{ nom: "kbis-acme.pdf", url: "https://files.paleonis.fr/tickets/2/kbis-acme.pdf" }] },
];

const seed = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  // init() crée les index (unique, texte, TTL) avant d'insérer.
  await Promise.all([FicheTechnique.init(), Evenement.init(), Message.init()]);

  await FicheTechnique.deleteMany({});
  await Evenement.deleteMany({});
  await Message.deleteMany({});

  // Création via le discriminator pour que chaque document soit validé par son sous-schéma.
  for (const fiche of fiches) {
    await FicheTechnique.discriminators[fiche.categorie].create(fiche);
  }
  for (const evenement of evenements) {
    await Evenement.discriminators[evenement.type].create(evenement);
  }
  await Message.insertMany(messages);

  console.log(
    `${fiches.length} fiches, ${evenements.length} événements, ${messages.length} messages insérés.`,
  );
};

seed()
  .catch((error) => {
    console.error("Seed impossible :", error.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
