#!/bin/bash
# Script de mise à jour du site depuis GitHub.
# À exécuter depuis le terminal SSH alwaysdata, à la racine (~) :
#   bash site-intervention/update.sh

set -e

echo "→ Récupération des dernières modifications depuis GitHub..."
cd ~/site-intervention
git pull

echo "→ Installation des dépendances (si elles ont changé)..."
cd server
npm install

echo ""
echo "✅ Mise à jour terminée."
echo "⚠️  Étape manuelle restante : retournez dans le tableau de bord alwaysdata"
echo "   (Web → Sites → icône 🔄 à côté de sigrys.alwaysdata.net) pour redémarrer"
echo "   le serveur et appliquer les changements."
