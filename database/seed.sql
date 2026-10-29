-- Jeu d'essai PostgreSQL, exécuté après schema.sql au premier démarrage du conteneur.
-- Les ids générés (1, 2, 3...) sont réutilisés par scripts/seed-mongo.js.

BEGIN;

INSERT INTO datacenter (nom, ville) VALUES
    ('DC-PAR-01', 'Paris'),
    ('DC-LYO-01', 'Lyon');

INSERT INTO offre (nom, categorie, prix_mensuel_ht, en_vente) VALUES
    ('VPS Start',        'VPS',                   5.99,  TRUE),
    ('VPS Pro',          'VPS',                  19.99,  TRUE),
    ('Mutualisé Perso',  'HEBERGEMENT_MUTUALISE',  2.49,  TRUE),
    ('Dédié Advance',    'SERVEUR_DEDIE',         79.00,  TRUE),
    ('Domaine .fr',      'NOM_DE_DOMAINE',         0.65,  FALSE);

INSERT INTO serveur (datacenter_id, nom_hote, adresse_ip, statut) VALUES
    (1, 'srv-par-001.hosting.lan', '10.0.1.11', 'EN_SERVICE'),
    (1, 'srv-par-002.hosting.lan', '10.0.1.12', 'MAINTENANCE'),
    (2, 'srv-lyo-001.hosting.lan', '10.0.2.11', 'EN_SERVICE');

INSERT INTO technicien (datacenter_id, nom, prenom, mail_pro) VALUES
    (1, 'Dupont', 'Marie', 'm.dupont@hosting.fr'),
    (2, 'Nguyen', 'Luc',   'l.nguyen@hosting.fr');

-- CTE : insère le client et réutilise son id généré pour la ligne du sous-type.
WITH c AS (
    INSERT INTO client (type, email, tel) VALUES ('PARTICULIER', 'jean.martin@mail.fr', '0612345678')
    RETURNING id
)
INSERT INTO particulier (client_id, nom) SELECT id, 'Martin' FROM c;

WITH c AS (
    INSERT INTO client (type, email, tel) VALUES ('ENTREPRISE', 'contact@acme.fr', NULL)
    RETURNING id
)
INSERT INTO entreprise (client_id, siret, raison_sociale) SELECT id, '12345678901234', 'ACME SAS' FROM c;

INSERT INTO abonnement (client_id, offre_id, serveur_id, date_debut, statut, prix_applique) VALUES
    (1, 1, 1, CURRENT_DATE - 60, 'ACTIF', 5.99),
    (2, 4, 3, CURRENT_DATE - 10, 'ACTIF', 69.00);

INSERT INTO ticket (client_id, technicien_id, serveur_id, sujet, description, priorite, statut) VALUES
    (1, 1, 1, 'Serveur inaccessible', 'Plus de réponse en SSH depuis ce matin.', 'CRITIQUE', 'EN_COURS'),
    (2, NULL, NULL, 'Question facturation', 'Je souhaite une facture au nom de la société.', 'BASSE', 'OUVERT');

COMMIT;
