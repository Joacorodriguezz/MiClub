#!/usr/bin/env bash
# Verificación mínima del setup CP1. Uso:
#   ./infra/verify-setup.sh https://tu-api.onrender.com https://tu-app.vercel.app
# o:
#   MICLUB_API_URL=... MICLUB_FRONTEND_URL=... ./infra/verify-setup.sh

set -euo pipefail

API_URL="${1:-${MICLUB_API_URL:-}}"
FRONTEND_URL="${2:-${MICLUB_FRONTEND_URL:-}}"

if [[ -z "$API_URL" || -z "$FRONTEND_URL" ]]; then
  echo "Uso: $0 <URL_API> <URL_FRONTEND>" >&2
  echo "  o definir MICLUB_API_URL y MICLUB_FRONTEND_URL" >&2
  exit 1
fi

API_URL="${API_URL%/}"
FRONTEND_URL="${FRONTEND_URL%/}"

echo "→ Health check: ${API_URL}/health"
HEALTH=$(curl -sf "${API_URL}/health")
echo "  ${HEALTH}"
echo "$HEALTH" | grep -q '"status"[[:space:]]*:[[:space:]]*"ok"' || {
  echo "ERROR: /health no devolvió status ok" >&2
  exit 1
}

echo "→ Frontend HTTPS: ${FRONTEND_URL}"
STATUS=$(curl -sf -o /dev/null -w "%{http_code}" "${FRONTEND_URL}")
echo "  HTTP ${STATUS}"
[[ "$STATUS" == "200" ]] || {
  echo "ERROR: frontend no respondió 200" >&2
  exit 1
}

echo "OK — comprobaciones mínimas del checkpoint 01 pasaron."
