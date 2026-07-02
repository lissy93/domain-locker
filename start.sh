#!/bin/sh

#==============================================================================#
# Load Docker secrets as environment variables (if they exist)
#==============================================================================#

# allow setting environment variables with docker secrets
# the format is <variable-name>__FILE
SUFFIX="_FILE"

# loop through all environment variables
for VAR in $(printenv | awk -F= '{print $1}'); do
	case "$VAR" in
		*"$SUFFIX")
			ENV_FILE_NAME="$(printenv "${VAR}")"
			ENV_VAR="${VAR%"$SUFFIX"}"

			if printenv "$ENV_VAR" >/dev/null 2>&1; then
				echo "warning: Both $ENV_VAR and $VAR are set. $VAR will override $ENV_VAR."
			fi

			if [ -r "$ENV_FILE_NAME" ]; then
				VALUE="$(cat "$ENV_FILE_NAME")"
				export "${ENV_VAR}=${VALUE}"
				echo "$ENV_VAR environment variable was set by secret file $ENV_FILE_NAME"
			else
				echo "warning: Secret file $ENV_FILE_NAME for $VAR is not readable or does not exist."
			fi
			;;
	esac
done

#==============================================================================#
# This is the entrypoint script for starting Domain Locker in Docker.
# It checks everything is setup correctly, all required env vars are set,
# and then initialized and tests the database, before starting the app.
# This script can be skipped by setting the DL_SKIP_INIT env var to true.

#==============================================================================#
# Check if script should be terminated early, to stat app immediately
#==============================================================================#

# Let user skip all checks and initialization, if DL_SKIP_INIT env var is set
if [ -n "$DL_SKIP_INIT" ]; then
  echo "Skipping initialization, and starting app directly"
  exec node ./dist/analog/server/index.mjs
fi

# Skip checks if using Supabase or is managed instance
if { [ -n "$SUPABASE_URL" ] && [ -n "$SUPABASE_ANON_KEY" ]; } || \
   [ "$DL_ENV_TYPE" = "managed" ]; then
  echo "Skipping initialization, as not self-hosted instance, or using Postgres"
  exec node ./dist/analog/server/index.mjs
fi

#==============================================================================#
# Set variables to use later
#==============================================================================#

# ANSI color codes (build with printf so we don't depend on echo -e or $'...')
ESC=$(printf '\033')
ERR="${ESC}[0;31m❌"
WARN="${ESC}[1;33m⚠️"
SUCCESS="${ESC}[0;32m✅"
# INFO begins with a literal newline (POSIX-safe; just embed the newline)
INFO="
ℹ️ ${ESC}[90m"
RESET="${ESC}[0m"

PURPLE="${ESC}[0;35m"
BOLD_PURPLE="${ESC}[1;35m"

# Other vars
MAX_WAIT=600
WARNINGS_FOUND=0

#==============================================================================#
# Welcome message, app info
#==============================================================================#

# Print totally pointless, but kinda cool ASCII art
cat <<EOF
${PURPLE}
██████╗  ██████╗ ███╗   ███╗ █████╗ ██╗███╗   ██╗
██╔══██╗██╔═══██╗████╗ ████║██╔══██╗██║████╗  ██║
██║  ██║██║   ██║██╔████╔██║███████║██║██╔██╗ ██║
██║  ██║██║   ██║██║╚██╔╝██║██╔══██║██║██║╚██╗██║
██████╔╝╚██████╔╝██║ ╚═╝ ██║██║  ██║██║██║ ╚████║
╚═════╝  ╚═════╝ ╚═╝     ╚═╝╚═╝  ╚═╝╚═╝╚═╝  ╚═══╝

██╗      ██████╗  ██████╗██╗  ██╗███████╗██████╗
██║     ██╔═══██╗██╔════╝██║ ██╔╝██╔════╝██╔══██╗
██║     ██║   ██║██║     █████╔╝ █████╗  ██████╔╝
██║     ██║   ██║██║     ██╔═██╗ ██╔══╝  ██╔══██╗
███████╗╚██████╔╝╚██████╗██║  ██╗███████╗██║  ██║
╚══════╝ ╚═════╝  ╚═════╝╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝

${BOLD_PURPLE}Source at https://github.com/lissy93/domain-locker
${PURPLE}Licensed under MIT. Coded with ☕ and ❤️ by Lissy93${RESET}
EOF

#==============================================================================#
# Run checks: version, environment, commands, is docker, etc
#==============================================================================#

# Check current version
VERSION=$(node -e "console.log(require('./package.json').version)" 2>/dev/null)
VERSION=${VERSION:-0.0.0}
echo "${INFO} Checking version...${RESET}"
echo "${SUCCESS} Domain Locker v${VERSION}${RESET}"

# Start environment checks
echo "${INFO} Checking environment...${RESET}"

# Check psql and node are installed, and that the app is built
[ -x "$(command -v psql)" ] || {
  echo "${WARN} psql (Postgres client) not found in PATH${RESET}"
  WARNINGS_FOUND=1
}
[ -x "$(command -v node)" ] || {
  echo "${WARN} node not found in PATH. Is it installed?${RESET}"
  WARNINGS_FOUND=1
}
[ -f "./dist/analog/server/index.mjs" ] || {
  echo "${WARN} App entrypoint not found. Did you run the build?${RESET}"
  WARNINGS_FOUND=1
}

# Check if in Docker
if [ ! -f /.dockerenv ]; then
  echo "${WARN} This doesn't appear to be a Docker container${RESET}"
fi

# Check required environment variables
REQUIRED_VARS="DL_PG_HOST DL_PG_PORT DL_PG_USER DL_PG_NAME DL_PG_PASSWORD"
for VAR in $REQUIRED_VARS; do
  if [ -z "$(eval echo \$$VAR)" ]; then
    echo "${WARN} Environment variable $VAR is not set${RESET}"
    WARNINGS_FOUND=1
  fi
done

# Warn if using default insecure password
if [ "$DL_PG_PASSWORD" = "changeme2420" ]; then
  echo "${WARN} Using default password! Set DL_PG_PASSWORD in .env for production${RESET}"
fi

# Success message if everything looks good
if [ "$WARNINGS_FOUND" -eq 0 ]; then
  echo "${SUCCESS} All environment checks have passed${RESET}"
else
  printf '\n%s\n' "${ERR} Unable to start app, as issues were found${RESET}"
  printf '\n%s[94mIf you think this is a false positive, you can set the %s %s\n\n' \
    "${ESC}" \
    "'DL_SKIP_INIT' environment variable to true, to skip the checks" \
    "and initialization, and attempt to start the app anyway."
  exit 1
fi

#==============================================================================#
# Postgres initialisation, schema application, and connection test
#==============================================================================#

# Wait for Postgres to be ready
echo "${INFO} Waiting for Postgres at ${DL_PG_HOST}:${DL_PG_PORT}...${RESET}"
elapsed=0
while ! pg_isready -h "$DL_PG_HOST" -p "$DL_PG_PORT" -U "$DL_PG_USER" > /dev/null 2>&1; do
  sleep 1
  elapsed=$((elapsed + 1))
  if [ $((elapsed % 30)) -eq 0 ]; then
    echo "${WARN} Postgres doesn't appear to be ready yet, after ${elapsed}s." \
      "Still waiting...${RESET}"
  fi
  if [ "$elapsed" -ge "$MAX_WAIT" ]; then
    echo "${ERR} Postgres not ready after ${MAX_WAIT}s. Exiting.${RESET}"
    exit 1
  fi
done
echo "${SUCCESS} Postgres is ready (took ${elapsed}s)${RESET}"

# Check if schema is applied / and apply it
SCHEMA_FILE=./schema.sql
[ -f "$SCHEMA_FILE" ] || SCHEMA_FILE=./db/schema.sql
echo "${INFO} Applying schema from ${SCHEMA_FILE}...${RESET}"
PGPASSWORD="$DL_PG_PASSWORD" \
  psql -h "$DL_PG_HOST" -p "$DL_PG_PORT" -U "$DL_PG_USER" \
  -d "$DL_PG_NAME" -f "$SCHEMA_FILE" || {
    echo "${ERR} Failed to apply schema. See error above.${RESET}"
  } \
  && echo "${SUCCESS} Schema applied successfully${RESET}" \
  || echo "${ERR} Failed to apply schema${RESET}"

# Testing the database connection
echo "${INFO} Testing database connection...${RESET}"
PGPASSWORD="$DL_PG_PASSWORD" \
  psql -h "$DL_PG_HOST" -p "$DL_PG_PORT" -U "$DL_PG_USER" \
  -d "$DL_PG_NAME" -c "SELECT 1;" > /dev/null 2>&1 \
  && echo "${SUCCESS} Database connection test succeeded${RESET}" \
  || echo "${ERR} Database connection test failed${RESET}"

#==============================================================================#
# All done, start the app!
#==============================================================================#

# Start the app!
echo "${INFO} Starting Domain Locker${RESET}"
printf '%s\n\n' "${SUCCESS} Ready at http://localhost:${PORT:-3000}${RESET}"
exec node ./dist/analog/server/index.mjs
