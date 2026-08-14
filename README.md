# seniorapi

## Database environments

This app uses Neon in two different ways:

- Development: Neon Local runs in Docker and exposes a local Postgres endpoint.
- Production: the app connects directly to Neon Cloud through `DATABASE_URL`.

The runtime chooses the right behavior from `NODE_ENV` and the host in `DATABASE_URL`.

## Local development

1. Fill in `.env.development` with your Neon API key, Neon project ID, and parent branch ID.
2. Start the stack:

```bash
docker compose -f docker-compose.dev.yml --env-file .env.development up --build
```

The app will run on `http://localhost:3000` and Neon Local will listen on `localhost:5432`.

Development connection string:

```bash
DATABASE_URL=postgres://neon:npg@neon-local:5432/neondb
```

Neon Local creates ephemeral branches when `PARENT_BRANCH_ID` is set, so each compose run starts from a fresh branch and deletes it when the container stops.

## Production

Production does not use Neon Local. The app runs in Docker and connects to Neon Cloud through the standard Neon database URL.

1. Set the real production values in `.env.production` or inject them from your platform secrets.
2. Start the app container:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production up --build
```

Production connection string:

```bash
DATABASE_URL=postgresql://user:password@your-project.neon.tech/your_database?sslmode=require
```

## Environment switching

- `NODE_ENV=development` loads `.env.development`
- `NODE_ENV=production` loads `.env.production`

If `DATABASE_URL` points to `localhost`, `127.0.0.1`, or `neon-local`, the app configures the Neon serverless driver for Neon Local automatically.

## Migrations

Run Drizzle migrations against whichever environment file you want to target:

```bash
NODE_ENV=development npm run db:migrate
NODE_ENV=production npm run db:migrate
```

## Notes

- `docker-compose.prod.yml` intentionally does not start a Neon database container, because Neon Cloud is external infrastructure.
- The app still uses the Neon serverless driver in both environments; only the connection target changes.
