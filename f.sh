#!/usr/bin/env bash
# Publica EcoQuest en Firebase Hosting desde Cloud Shell. Se usa así:  bash f.sh
# No activa pagos, no borra nada y no cambia GitHub.
AQUI="$(cd "$(dirname "$0")" && pwd)"
SITIO="ecoquest-sonora"
PROYECTO="${DEVSHELL_PROJECT_ID:-${GOOGLE_CLOUD_PROJECT:-ecoquest-sonora}}"
echo "Proyecto: $PROYECTO   Sitio: $SITIO"

FB="$(command -v firebase || true)"
[ -z "$FB" ] && FB="npx -y firebase-tools"

TMP="$(mktemp -d)"
mkdir "$TMP/sitio"
# Solo los archivos públicos de la página
cp -r "$AQUI"/index.html "$AQUI"/*.css "$AQUI"/*.js "$AQUI"/datos "$AQUI"/imagenes "$AQUI"/lib "$TMP/sitio/" || { echo "ERROR: no se encontraron los archivos de EcoQuest"; exit 1; }
cd "$TMP" || exit 1
cat > firebase.json <<EOF
{"hosting":{"site":"$SITIO","public":"sitio","ignore":["**/.*"],
 "headers":[{"source":"**/*.@(html|json)","headers":[{"key":"Cache-Control","value":"no-cache"}]}]}}
EOF

echo "1/2 Reservando la direccion (si ya existe, es normal que avise)..."
$FB hosting:sites:create "$SITIO" --project "$PROYECTO" --non-interactive
echo "2/2 Publicando..."
if $FB deploy --only hosting --project "$PROYECTO" --non-interactive; then
  echo ""
  echo "=== LISTO === https://$SITIO.web.app"
else
  echo ""
  echo "=== ERROR: manda captura de esta pantalla ==="
  echo "Proyectos disponibles:"; gcloud projects list --format="value(projectId)" 2>/dev/null
fi
