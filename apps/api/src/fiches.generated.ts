// GÉNÉRÉ par `npm run fiches` (lot K1 : config/jeux/<id>.json → serveur) — NE PAS MODIFIER À LA MAIN : changer la fiche du jeu, puis relancer la commande.
// Un test vérifie que ce fichier est à jour.
export const FICHES_SERVEUR = [
  {
    "id": "track",
    "code": "cdj",
    "etatDepart": "on",
    "premierJour": "2026-10-13",
    "classement": {
      "colonnes": [
        {
          "nom": "ms",
          "sens": "asc"
        },
        {
          "nom": "submitted_at",
          "sens": "asc"
        },
        {
          "nom": "player_id",
          "sens": "asc"
        }
      ],
      "cumul": true,
      "unite": "ms",
      "format": "temps"
    },
    "medailles": {
      "methode": "facteurs-auteur",
      "bareme": [
        0.92,
        1.045,
        1.07,
        1.13
      ]
    },
    "versions": {
      "sim": "packages/sim/src/constants.ts:SIM_VERSION",
      "generateur": "packages/sim/src/constants.ts:GENERATOR_VERSION"
    },
    "jours": {
      "mode": "registre",
      "registre": "packages/sim/src/jours-track.json",
      "preuveInterditeEnProd": false
    },
    "rejeu": {
      "unitesServeur": 1,
      "maxTicks": 72000,
      "ticksParUnite": 5000
    },
    "tables": [
      {
        "nom": "results",
        "sort": "videe"
      },
      {
        "nom": "garage_choices",
        "sort": "videe"
      },
      {
        "nom": "salon_runs",
        "sort": "videe"
      },
      {
        "nom": "salon_sessions",
        "sort": "videe"
      },
      {
        "nom": "salon_circuits",
        "sort": "videe"
      },
      {
        "nom": "salon_presence",
        "sort": "videe"
      },
      {
        "nom": "salon_throttle",
        "sort": "videe"
      },
      {
        "nom": "circuits",
        "sort": "gardee"
      },
      {
        "nom": "planning",
        "sort": "gardee"
      }
    ],
    "prefixe": "cdj:",
    "reglagesGardes": [],
    "messageOu": "track",
    "zoneNouveautes": "track"
  },
  {
    "id": "jump",
    "code": "jump",
    "etatDepart": "on",
    "premierJour": "2026-10-16",
    "classement": {
      "colonnes": [
        {
          "nom": "ticks",
          "sens": "asc"
        },
        {
          "nom": "submitted_at",
          "sens": "asc"
        },
        {
          "nom": "player_id",
          "sens": "asc"
        }
      ],
      "cumul": true,
      "unite": "ticks",
      "format": "temps"
    },
    "medailles": {
      "methode": "figees-niveau",
      "bareme": []
    },
    "versions": {
      "sim": "packages/jump-sim/src/constants.ts:JUMP_SIM_VERSION",
      "generateur": "packages/jump-sim/src/constants.ts:JUMP_GENERATOR_VERSION",
      "medailles": "packages/jump-sim/src/jours.ts:MEDAILLES_ASSOUPLIES_VERSION"
    },
    "jours": {
      "mode": "fichier-par-jour",
      "dossier": "apps/jump/public/levels",
      "preuveInterditeEnProd": true
    },
    "rejeu": {
      "unitesServeur": 1,
      "maxTicks": 72000,
      "ticksParUnite": 5000
    },
    "tables": [
      {
        "nom": "jump_results",
        "sort": "videe"
      },
      {
        "nom": "jump_lives",
        "sort": "videe"
      },
      {
        "nom": "jump_deaths",
        "sort": "videe"
      },
      {
        "nom": "jump_levels",
        "sort": "gardee"
      }
    ],
    "prefixe": "jump:",
    "reglagesGardes": [],
    "messageOu": "jump",
    "zoneNouveautes": "jump"
  },
  {
    "id": "tower",
    "code": "tower",
    "etatDepart": "off",
    "premierJour": "2026-11-02",
    "classement": {
      "colonnes": [
        {
          "nom": "hauteur_mm",
          "sens": "desc"
        },
        {
          "nom": "vies",
          "sens": "desc"
        },
        {
          "nom": "ticks",
          "sens": "asc"
        },
        {
          "nom": "submitted_at",
          "sens": "asc"
        },
        {
          "nom": "player_id",
          "sens": "asc"
        }
      ],
      "cumul": false,
      "unite": "mm",
      "format": "hauteur"
    },
    "medailles": {
      "methode": "pourcentage-diamant",
      "bareme": [
        50,
        30,
        15
      ],
      "plafondDiamant": 60000
    },
    "versions": {
      "sim": "packages/tower-sim/src/constantes.ts:TOWER_SIM_VERSION",
      "generateur": "packages/tower-sim/src/generateur/index.ts:TOWER_GENERATOR_VERSION",
      "medailles": "packages/tower-sim/src/medailles.ts:MEDAILLES_VERSION"
    },
    "jours": {
      "mode": "fichier-par-jour",
      "dossier": "apps/tower/public/jours",
      "preuveInterditeEnProd": true
    },
    "rejeu": {
      "unitesServeur": 30,
      "fil": true,
      "maxTicks": 20300
    },
    "tables": [
      {
        "nom": "tower_results",
        "sort": "videe"
      },
      {
        "nom": "tower_levels",
        "sort": "gardee"
      }
    ],
    "prefixe": "tower:",
    "reglagesGardes": [],
    "messageOu": "tower",
    "zoneNouveautes": "tower"
  }
] as const;
