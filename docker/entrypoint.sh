#!/bin/sh
# Runs before every service process starts.
#
# Render's free plan does not support pre-deploy commands, so database
# migrations cannot run there. Each image applies its own Prisma migrations
# here instead. `prisma migrate deploy` is idempotent and reads only the
# migrations/ directory shipped inside this image.
#
# On the free plan all three database services share one Postgres instance but
# keep separate migration histories. That is safe because each service applies
# only its own additive init migration; `db push` is deliberately NOT used
# because it would sync the whole database to one service's schema and drop the
# other services' tables.
set -e

if [ -f prisma/schema.prisma ]; then
  echo "[entrypoint] applying Prisma migrations"
  if [ -x /usr/src/app/node_modules/.bin/prisma ]; then
    PRISMA=/usr/src/app/node_modules/.bin/prisma
  else
    PRISMA=./node_modules/.bin/prisma
  fi
  "$PRISMA" migrate deploy --schema prisma/schema.prisma
fi

exec "$@"
