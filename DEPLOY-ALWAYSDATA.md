# Déployer sur alwaysdata (gratuit, sans carte bancaire)

alwaysdata est un hébergeur français avec une offre gratuite à vie, sans carte
bancaire requise, et qui supporte Node.js jusqu'à la version 22 ainsi que le
stockage de fichiers persistant (donc votre base SQLite ne sera jamais effacée).

## 1. Créer le compte

1. Allez sur https://www.alwaysdata.com
2. Cliquez **S'inscrire** / **Create an account**
3. Remplissez le formulaire (email, mot de passe) — aucune carte bancaire demandée.
4. Confirmez votre email.

## 2. Activer l'accès SSH

1. Dans le tableau de bord, allez dans **Accès distant** (Remote access) → **SSH**
2. Notez l'adresse SSH fournie (quelque chose comme `ssh votre-compte@ssh-votre-compte.alwaysdata.net`)
3. Définissez un mot de passe SSH si demandé (ou utilisez une clé si vous en avez une)

alwaysdata propose aussi un **terminal SSH directement dans le navigateur**
(cherchez "Console" ou "Terminal web" dans le tableau de bord) — pratique si
vous ne voulez rien installer sur votre PC.

## 3. Récupérer le code depuis GitHub (via SSH)

Connectez-vous en SSH (ou ouvrez la console web), puis :

```bash
git clone https://github.com/VOTRE-USER/VOTRE-DEPOT.git site-intervention
cd site-intervention/server
npm install
```

## 4. Configurer les variables d'environnement

Dans le tableau de bord alwaysdata : **Environnement** → **Variables** (ou
section équivalente selon la version de l'interface), ajoutez :

| Nom | Valeur |
|---|---|
| `ADMIN_PASSWORD` | votre mot de passe admin |
| `SESSION_SECRET` | une chaîne aléatoire (ex: `x7Kp9mQ2vL8nR4wT`) |
| `LAMBERT_ZONE` | `LAMBERT_NORD` |

## 5. Créer le site Node.js

1. Dans le tableau de bord : **Web** → **Sites** → **Ajouter un site**
2. Type de site : **Node.js**
3. **Commande** à renseigner (remplacez `votre-compte` par votre identifiant alwaysdata) :
```
node /home/votre-compte/site-intervention/server/server.js
```
4. Choisissez la version Node.js : **22**
5. Validez.

⚠️ Important : ne mettez PAS de port fixe (3000) dans vos réglages — alwaysdata
fournit automatiquement les variables `PORT` et `HOST`/`IP` à votre application,
et le code du projet les utilise déjà correctement (`server.js` a été adapté
pour ça).

## 6. Vérification

Une fois le site créé, alwaysdata vous donne une URL du type
`https://votre-compte.alwaysdata.net` — ouvrez-la, la carte doit s'afficher.

Testez aussi `/admin.html` et connectez-vous avec votre `ADMIN_PASSWORD`.

## 7. Mettre à jour le site plus tard

Quand vous modifiez le code sur GitHub, reconnectez-vous en SSH et faites :

```bash
cd site-intervention
git pull
cd server
npm install
```

Puis redémarrez le site Node.js depuis le tableau de bord (bouton "Redémarrer"
dans la page du site) pour que les changements soient pris en compte.

## Limites du plan gratuit à connaître

- Pensé pour un usage personnel/petit projet — largement suffisant pour une
  équipe interne de taille raisonnable, mais pas conçu pour un trafic massif.
- Ressources CPU/RAM limitées par rapport à un serveur dédié.
- Support par ticket uniquement sur l'offre gratuite (pas de chat en direct).

Si votre équipe grandit ou que l'usage devient plus intensif, alwaysdata permet
de migrer vers une offre payante sans perdre vos données.
