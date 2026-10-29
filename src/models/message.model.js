// Modèle MongoDB (Mongoose) : le schéma valide chaque document avant écriture.
// Un document par message, relié au ticket PostgreSQL par ticketId (référence, pas de jointure possible).

const { Schema, model } = require("mongoose");

const messageSchema = new Schema(
  {
    // Id du ticket dans PostgreSQL.
    ticketId: { type: Number, required: true },
    auteur: {
      type: { type: String, enum: ["CLIENT", "TECHNICIEN"], required: true },
      // Id du client ou du technicien dans PostgreSQL.
      id: { type: Number, required: true },
    },
    contenu: { type: String, required: true, trim: true, maxlength: 5000 },
    piecesJointes: [
      {
        _id: false,
        nom: { type: String, required: true, trim: true },
        url: { type: String, required: true, match: /^https?:\/\/\S+$/ },
      },
    ],
  },
  // createdAt automatique ; pas d'updatedAt car un message n'est jamais modifié. Pas de champ __v.
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false },
);

// Index adapté à la seule lecture faite : tout le fil d'un ticket, dans l'ordre chronologique.
messageSchema.index({ ticketId: 1, createdAt: 1 });

const Message = model("Message", messageSchema, "messages");

Message.filDuTicket = (ticketId) => Message.find({ ticketId }).sort({ createdAt: 1 });

module.exports = Message;
