// Routes : associe chaque URL + méthode HTTP à une fonction du contrôleur. Aucune logique ici.
// Ticket dans PostgreSQL, fil de messages dans MongoDB.

const express = require("express");
const {
  createTicket,
  getTicket,
  addMessage,
  deleteTicket,
  assignTicket,
  updateTicketStatut,
  listTicketsTechnicien,
} = require("../controllers/ticket.controller");

const router = express.Router();

router.post("/tickets", createTicket);
router.get("/tickets/:id", getTicket);
router.delete("/tickets/:id", deleteTicket);
router.post("/tickets/:id/messages", addMessage);
router.patch("/tickets/:id/assignation", assignTicket);
// Changement de statut, contrôlé par la machine à états du modèle Ticket.
router.patch("/tickets/:id/status", updateTicketStatut);
// Tickets non fermés d'un technicien (placée ici car elle concerne les tickets).
router.get("/techniciens/:id/tickets", listTicketsTechnicien);

module.exports = router;
