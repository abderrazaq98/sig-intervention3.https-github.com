# Site des sites d'intervention

Application web pour visualiser sur une carte et rechercher vos sites d'intervention
(par numéro IG, adresse ou coordonnées), avec un espace admin pour gérer les points.

## Structure du projet

```
site-intervention/
├── server/              # Backend Node.js / Express
│   ├── server.js        # Point d'entrée du serveur
│   ├── db.js             # Base de données SQLite (node:sqlite intégré)
│   ├── coords.js         # Conversion Lambert Maroc <-> GPS (WGS84)
│   ├── auth.js           # Authentification admin
│   ├── routes/points.js  # API : recherche, CRUD, import Excel
│   └── .env.example      # Modèle de configuration
└── public/              # Frontend (servi directement par le serveur)
    ├── index.html         # Carte publique + recherche
    ├── admin.html         # Interface d'administration
    ├── css/style.css
    └── js/{map.js, admin.js}
```

## Prérequis

- **Node.js version 22.5 ou supérieure** (le projet utilise le module SQLite
  intégré à Node, ce qui évite toute compilation native compliquée à installer).
  Vérifiez avec : `node --version`

## Installation

```bash
cd server
npm install
cp .env.example .env
```

Ouvrez `server/.env` et changez au minimum :
- `ADMIN_PASSWORD` → le mot de passe de l'espace admin
- `SESSION_SECRET` → une chaîne aléatoire quelconque (sécurité des sessions)

## Démarrage

```bash
cd server
npm start
```

Le site est accessible sur : **http://localhost:3000**
L'espace admin : **http://localhost:3000/admin.html**

## ⚠️ Étape importante : vérifier la projection Lambert

Vos coordonnées X/Y sont en Lambert marocain (Merchich). Il existe 3 variantes
selon la région (Nord, Sud, Sahara). Le projet est configuré par défaut sur
**Lambert Nord Maroc**, adapté à votre zone (Tétouan / Tanger-Tétouan-Al Hoceima).

**Avant d'importer toutes vos données**, vérifiez avec UN point dont vous connaissez
l'adresse réelle :

1. Démarrez le serveur.
2. Dans l'espace admin, ajoutez ce point test avec son X et son Y réels.
3. Regardez sur la carte publique si le marqueur tombe au bon endroit.

Si le point apparaît au mauvais endroit (ex: dans un pays voisin, dans la mer,
ou décalé de plusieurs centaines de km), cela veut dire que la zone Lambert
n'est pas la bonne. Changez alors dans `server/.env` :

```
LAMBERT_ZONE=LAMBERT_SUD
```

(valeurs possibles : `LAMBERT_NORD`, `LAMBERT_SUD`, `LAMBERT_SAHARA`), puis
redémarrez le serveur.

## Import de votre fichier Excel

Dans l'espace admin, bouton **"Importer Excel"**. Le fichier doit contenir des
colonnes nommées (l'ordre n'a pas d'importance, la casse et les accents non plus) :

| Colonne attendue | Variantes reconnues |
|---|---|
| IG | `IG`, `Numero IG`, `N IG` |
| Adresse | `Adresse`, `Address` |
| X | `X` |
| Y | `Y` |

Les coordonnées GPS (latitude/longitude) sont calculées automatiquement à partir
de X/Y au moment de l'import — vous n'avez rien d'autre à faire.

Vous pouvez importer plusieurs fichiers à la suite : les nouveaux points s'ajoutent
à ceux déjà présents (l'import n'écrase pas la base).

## Recherche (carte publique)

La barre de recherche propose 3 modes :
- **Numéro IG** : recherche partielle sur le numéro IG
- **Adresse** : recherche partielle sur l'adresse
- **Coordonnées** : format `latitude, longitude` (ex: `35.578, -5.368`), retourne
  les points les plus proches

## Déploiement pour votre équipe

Pour que vos intervenants y accèdent depuis leurs postes ou téléphones, il faut
héberger ce serveur sur une machine accessible en réseau :

- **Réseau local d'entreprise** : lancez `npm start` sur un PC/serveur du réseau,
  et vos collègues accèdent via `http://<IP-de-la-machine>:3000`.
- **Hébergement cloud** (recommandé pour un accès depuis n'importe où) : des
  plateformes comme Railway, Render, ou un VPS (OVH, Scaleway...) permettent de
  déployer ce type d'application Node.js facilement. Je peux vous accompagner
  sur ce choix si besoin — dites-moi simplement votre budget et si vous préférez
  une solution marocaine/française ou internationale.
- Pensez à mettre en place **HTTPS** avant un accès depuis internet (un reverse
  proxy comme Nginx ou Caddy s'en charge facilement), pour protéger le mot de
  passe admin en transit.

## Sécurité — points à connaître

- L'espace admin est protégé par un seul mot de passe partagé (adapté à votre
  besoin : un seul admin à la fois). Si plusieurs personnes doivent administrer
  avec des comptes séparés à l'avenir, ce sera une évolution à prévoir.
- La librairie d'import Excel (`xlsx`) a une vulnérabilité connue sans correctif
  à ce jour, mais sans risque réel ici car seul l'admin authentifié peut importer
  des fichiers (jamais exposé au public).
- Sauvegardez régulièrement le fichier `server/data/points.db` (c'est toute votre
  base de données).

## Prochaines améliorations possibles

- Export Excel/CSV des points depuis l'admin
- Historique des modifications
- Filtres avancés (par secteur, statut d'intervention...)
- Comptes admin multiples avec rôles différents
