#!/usr/bin/env bash
# Teste la migration + un scénario complet sur un Postgres local (sans Docker).
# Usage : bash supabase/tests/run_local.sh
set -euo pipefail
# Postgres Homebrew (si psql n'est pas déjà dans le PATH)
for v in 17 16 15; do [ -d "/opt/homebrew/opt/postgresql@$v/bin" ] && PATH="/opt/homebrew/opt/postgresql@$v/bin:$PATH" && break; done
cd "$(dirname "$0")/../.."
DB=${DB:-route1000_test}
dropdb --if-exists "$DB"
createdb "$DB"
psql -X -q -v ON_ERROR_STOP=1 -d "$DB" -f supabase/tests/local_bootstrap.sql 2>/dev/null
psql -X -q -v ON_ERROR_STOP=1 -d "$DB" -f supabase/migrations/20261101000000_route1000.sql >/dev/null 2>&1
psql -X -q -v ON_ERROR_STOP=1 -d "$DB" -f supabase/tests/game_scenario.sql
