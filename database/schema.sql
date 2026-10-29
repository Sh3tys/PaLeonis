-- Structure de la base PostgreSQL (tables, types, contraintes).
-- Exécuté automatiquement par Docker au premier démarrage, avant seed.sql (ordre alphabétique).

-- Tout dans une transaction : soit le schéma entier est créé, soit rien.
BEGIN;

-- ENUM : la base refuse toute valeur hors liste. Les mêmes listes existent côté JS.
CREATE TYPE type_client        AS ENUM ('PARTICULIER', 'ENTREPRISE');
CREATE TYPE categorie_offre    AS ENUM ('VPS', 'HEBERGEMENT_MUTUALISE', 'SERVEUR_DEDIE', 'NOM_DE_DOMAINE');
CREATE TYPE statut_abonnement  AS ENUM ('ACTIF', 'SUSPENDU', 'RESILIE');
CREATE TYPE statut_serveur     AS ENUM ('EN_SERVICE', 'MAINTENANCE', 'HORS_SERVICE');
CREATE TYPE priorite_ticket    AS ENUM ('BASSE', 'NORMALE', 'HAUTE', 'CRITIQUE');
CREATE TYPE statut_ticket      AS ENUM ('OUVERT', 'EN_COURS', 'RESOLU', 'FERME');

-- Héritage : client contient le commun, particulier / entreprise le spécifique.
-- UNIQUE (id, type) sert de cible aux clés étrangères composées des sous-tables.
CREATE TABLE client (
    id               INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    type             type_client  NOT NULL,
    email            VARCHAR(255) NOT NULL UNIQUE,
    tel              VARCHAR(30),
    date_inscription DATE         NOT NULL DEFAULT CURRENT_DATE,
    cree_le          TIMESTAMPTZ  NOT NULL DEFAULT now(),
    modifie_le       TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT client_id_type_key UNIQUE (id, type)
);

-- Le CHECK sur type + la FK composée garantissent qu'un client PARTICULIER
-- ne peut pas avoir de ligne dans entreprise (et inversement).
CREATE TABLE particulier (
    client_id INTEGER PRIMARY KEY,
    type      type_client  NOT NULL DEFAULT 'PARTICULIER'
              CHECK (type = 'PARTICULIER'),
    nom       VARCHAR(100) NOT NULL,
    CONSTRAINT particulier_client_fk
        FOREIGN KEY (client_id, type) REFERENCES client (id, type) ON DELETE CASCADE
);

CREATE TABLE entreprise (
    client_id      INTEGER PRIMARY KEY,
    type           type_client  NOT NULL DEFAULT 'ENTREPRISE'
                   CHECK (type = 'ENTREPRISE'),
    siret          CHAR(14)     NOT NULL UNIQUE CHECK (siret ~ '^[0-9]{14}$'),
    raison_sociale VARCHAR(150) NOT NULL,
    CONSTRAINT entreprise_client_fk
        FOREIGN KEY (client_id, type) REFERENCES client (id, type) ON DELETE CASCADE
);

-- Catalogue commercial. La fiche technique détaillée est dans MongoDB (offreId).
CREATE TABLE offre (
    id               INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nom              VARCHAR(100)   NOT NULL,
    categorie        categorie_offre NOT NULL,
    prix_mensuel_ht  NUMERIC(10,2)  NOT NULL CHECK (prix_mensuel_ht >= 0),
    en_vente         BOOLEAN        NOT NULL DEFAULT TRUE,
    cree_le          TIMESTAMPTZ    NOT NULL DEFAULT now(),
    modifie_le       TIMESTAMPTZ    NOT NULL DEFAULT now()
);

CREATE TABLE datacenter (
    id    INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nom   VARCHAR(100) NOT NULL UNIQUE,
    ville VARCHAR(100) NOT NULL
);

-- INET : type PostgreSQL dédié aux adresses IP (validées par la base).
CREATE TABLE serveur (
    id                    INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    datacenter_id         INTEGER        NOT NULL REFERENCES datacenter (id) ON DELETE RESTRICT,
    nom_hote              VARCHAR(255)   NOT NULL UNIQUE,
    adresse_ip            INET           NOT NULL UNIQUE,
    statut                statut_serveur NOT NULL DEFAULT 'EN_SERVICE',
    date_mise_en_service  DATE           NOT NULL DEFAULT CURRENT_DATE,
    cree_le               TIMESTAMPTZ    NOT NULL DEFAULT now(),
    modifie_le            TIMESTAMPTZ    NOT NULL DEFAULT now()
);

CREATE TABLE technicien (
    id            INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    datacenter_id INTEGER      NOT NULL REFERENCES datacenter (id) ON DELETE RESTRICT,
    nom           VARCHAR(100) NOT NULL,
    prenom        VARCHAR(100) NOT NULL,
    mail_pro      VARCHAR(255) NOT NULL UNIQUE
);

-- serveur_id UNIQUE : un serveur ne sert qu'un seul abonnement à la fois.
-- prix_applique fige le prix au moment de la souscription.
CREATE TABLE abonnement (
    id            INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    client_id     INTEGER           NOT NULL REFERENCES client (id)  ON DELETE RESTRICT,
    offre_id      INTEGER           NOT NULL REFERENCES offre (id)   ON DELETE RESTRICT,
    serveur_id    INTEGER UNIQUE             REFERENCES serveur (id) ON DELETE SET NULL,
    date_debut    DATE              NOT NULL DEFAULT CURRENT_DATE,
    date_fin      DATE,
    statut        statut_abonnement NOT NULL DEFAULT 'ACTIF',
    prix_applique NUMERIC(10,2)     NOT NULL CHECK (prix_applique >= 0),
    cree_le       TIMESTAMPTZ       NOT NULL DEFAULT now(),
    modifie_le    TIMESTAMPTZ       NOT NULL DEFAULT now(),
    CONSTRAINT abonnement_dates_chk CHECK (date_fin IS NULL OR date_fin >= date_debut),
    CONSTRAINT abonnement_resilie_chk CHECK (statut <> 'RESILIE' OR date_fin IS NOT NULL)
);

-- Les messages du ticket sont dans MongoDB (ticketId).
CREATE TABLE ticket (
    id             INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    client_id      INTEGER         NOT NULL REFERENCES client (id)     ON DELETE CASCADE,
    technicien_id  INTEGER                  REFERENCES technicien (id) ON DELETE SET NULL,
    serveur_id     INTEGER                  REFERENCES serveur (id)    ON DELETE SET NULL,
    sujet          VARCHAR(200)    NOT NULL,
    description    TEXT            NOT NULL,
    date_ouverture TIMESTAMPTZ     NOT NULL DEFAULT now(),
    priorite       priorite_ticket NOT NULL DEFAULT 'NORMALE',
    statut         statut_ticket   NOT NULL DEFAULT 'OUVERT',
    cree_le        TIMESTAMPTZ     NOT NULL DEFAULT now(),
    modifie_le     TIMESTAMPTZ     NOT NULL DEFAULT now()
);

-- Met à jour modifie_le automatiquement à chaque UPDATE, sans dépendre de l'API.
CREATE OR REPLACE FUNCTION set_modifie_le() RETURNS TRIGGER AS $$
BEGIN
    NEW.modifie_le := now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Pose le trigger sur chaque table qui a une colonne modifie_le.
DO $$
DECLARE t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY['client','offre','serveur','abonnement','ticket'] LOOP
        EXECUTE format(
            'CREATE TRIGGER trg_%1$s_modifie_le BEFORE UPDATE ON %1$I
             FOR EACH ROW EXECUTE FUNCTION set_modifie_le()', t);
    END LOOP;
END $$;

COMMIT;
