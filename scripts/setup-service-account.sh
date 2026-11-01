#!/usr/bin/env bash
# Installe la clé de compte de service Firebase (gratuite) sur Vercel puis redéploie.
# Usage : npm run setup:key -- ~/Downloads/route-1000-jeu-firebase-adminsdk-xxxxx.json
set -euo pipefail
KEY="${1:-}"
if [ -z "$KEY" ] || [ ! -f "$KEY" ]; then
  echo "Indiquez le chemin du fichier JSON téléchargé depuis Firebase."
  echo "Exemple : npm run setup:key -- ~/Downloads/route-1000-jeu-firebase-adminsdk-abc12.json"
  exit 1
fi
grep -q '"private_key"' "$KEY" || { echo "Ce fichier n'est pas une clé de compte de service Firebase."; exit 1; }
# CLI Vercel : globale si disponible, sinon via npx
if command -v vercel >/dev/null 2>&1; then VERCEL=(vercel); else VERCEL=(npx --yes vercel); fi
for ENV in production preview; do
  "${VERCEL[@]}" env rm FIREBASE_SERVICE_ACCOUNT "$ENV" --yes >/dev/null 2>&1 || true
  "${VERCEL[@]}" env add FIREBASE_SERVICE_ACCOUNT "$ENV" < "$KEY" >/dev/null
  echo "✔ Clé ajoutée sur Vercel ($ENV)"
done
"${VERCEL[@]}" --prod --yes >/dev/null
echo "✔ Redéployé : https://route-1000-coral.vercel.app"
echo "Vous pouvez supprimer le fichier JSON téléchargé : la clé est maintenant stockée chez Vercel."
