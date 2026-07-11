# Déployer sur Railway (à partir de votre dépôt GitHub)

## 1. Créer le compte et le projet

1. Allez sur https://railway.app et connectez-vous avec votre compte GitHub.
2. Cliquez **New Project** → **Deploy from GitHub repo**.
3. Choisissez votre dépôt `site-intervention`.

## 2. Indiquer où se trouve le code du serveur

Le fichier `package.json` se trouve dans le dossier `server/` (pas à la racine
du dépôt). Il faut donc le préciser à Railway :

1. Dans les paramètres du service créé, allez dans **Settings**.
2. Cherchez **Root Directory** et mettez : `server`
3. Railway va alors détecter automatiquement qu'il s'agit d'une app Node.js
   (grâce à `railway.json` déjà présent dans le dépôt) et lancer `npm install`
   puis `npm start`.

## 3. Configurer les variables d'environnement

Toujours dans les **Settings** du service, section **Variables**, ajoutez :

| Variable | Valeur |
|---|---|
| `ADMIN_PASSWORD` | votre mot de passe admin (changez-le !) |
| `SESSION_SECRET` | une chaîne aléatoire quelconque |
| `LAMBERT_ZONE` | `LAMBERT_NORD` (ou `LAMBERT_SUD` selon vérification) |
| `PORT` | Railway la fournit automatiquement, pas besoin de la définir |

## 4. Rendre la base de données persistante (important !)

Sans cette étape, **vos points seraient effacés à chaque redéploiement**.

1. Dans le projet Railway, cliquez **+ New** → **Volume**.
2. Attachez ce volume à votre service, avec comme **Mount path** : `/app/data`
3. Modifiez une seule ligne dans `server/db.js` avant de pousser sur GitHub,
   pour que la base utilise ce dossier en production :

```js
const DB_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
```

Et ajoutez la variable d'environnement sur Railway :

| Variable | Valeur |
|---|---|
| `DATA_DIR` | `/app/data` |

## 5. Déployer

Railway déploie automatiquement dès que les variables sont enregistrées, puis
à chaque `git push` sur la branche `main`. Une URL publique du type
`https://votre-projet.up.railway.app` vous est fournie — c'est celle que vous
partagerez à votre équipe.

## 6. Vérification

- Ouvrez l'URL fournie → la carte doit s'afficher.
- Ouvrez `.../admin.html` → connectez-vous avec votre `ADMIN_PASSWORD`.
- Ajoutez un point test, redéployez (ou attendez un futur push), vérifiez qu'il
  est toujours là → confirme que le volume persistant fonctionne bien.

## Coût

Railway offre un crédit d'essai gratuit puis facture à l'usage (quelques dollars
par mois pour ce type de petite application avec un usage d'équipe interne).
Vous pouvez suivre votre consommation dans l'onglet **Usage** du projet.
