#!/bin/sh
set -e

# Fix permissions for the database directory (mounted as volume)
# This is necessary because Docker mounts volumes as root by default on Linux
echo "Fixing permissions for database directory..."
chown -R nextjs:nodejs /app/prisma/data

# Run migrations as nextjs user
echo "Run database migrations..."
if su-exec nextjs:nodejs npx prisma migrate deploy; then
  echo "Migrations successful"
else
  echo "Migrations failed"
  exit 1
fi

# Start application as nextjs user
echo "Starting application..."
exec su-exec nextjs:nodejs node server.js