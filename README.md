# VendorProof Backend

VendorProof is an Express + TypeScript backend for vendor onboarding, KYC verification, trust scoring, and payment-link workflows.

It combines:

- Document OCR intelligence for NIN/CAC extraction
- Face matching for selfie-to-ID verification
- Queue-driven async processing with BullMQ + Redis
- Trust score/tier progression backed by PostgreSQL (Prisma)

## Tech Stack

- Runtime: Node.js + TypeScript
- API: Express
- Database: PostgreSQL + Prisma
- Queue: BullMQ + Redis
- File/Image services: Cloudinary, Sharp, Tesseract.js, face-api.js
- Notifications: SMS Gate + Nodemailer

## Project Structure

```txt
src/
  app.ts                    # Express app setup
  server.ts                 # Server entrypoint
  config/                   # env, db, redis, logger, middleware
  routes/                   # API route registration
  controllers/              # Request handlers
  services/                 # Core business logic
  infra/                    # External integrations (Cloudinary, SMS, etc.)
  queues/                   # Queue setup, workers, events
  utils/                    # OCR, face matching, trust scoring, helpers
prisma/
  schema.prisma             # Prisma schema
docs.yaml                   # OpenAPI spec used by Swagger UI
```

## Prerequisites

- Node.js 20+ (recommended)
- npm 10+
- PostgreSQL 15+ (or compatible)
- Redis 6+

## Quick Start (Local Development)

1. Install dependencies:

```bash
npm install
```

2. Create your environment file:

```bash
cp .env.sample .env
```

3. Update `.env` values (see Environment Variables section below).

4. Generate Prisma client:

```bash
npx prisma generate
```

5. Push schema to your local database:

```bash
npx prisma db push
```

6. Start the API in dev mode:

```bash
npm run dev
```

Server starts on `PORT` (default `3000`).

## Build And Run

Build production bundle:

```bash
npm run build
```

Run compiled server:

```bash
npm start
```

## API Docs

When `NODE_ENV` is not `production`, Swagger docs are served at:

- `GET /api/docs`

Health endpoint:

- `GET /api/health`

## Environment Variables

Copy `.env.sample` to `.env` and set the values below.

### Core Runtime

| Variable     | Required | Purpose                                             | Example                           |
| ------------ | -------- | --------------------------------------------------- | --------------------------------- |
| `NODE_ENV`   | Yes      | Runtime mode (`local`, `development`, `production`) | `local`                           |
| `PORT`       | Yes      | HTTP server port                                    | `3000`                            |
| `JWT_SECRET` | Yes      | JWT signing secret                                  | `replace-with-long-random-secret` |

### Database + Cache

| Variable                  | Required | Purpose                            | Example                                                   |
| ------------------------- | -------- | ---------------------------------- | --------------------------------------------------------- |
| `DATABASE_URL`            | Yes      | PostgreSQL connection string       | `postgres://postgres:postgres@localhost:5432/vendorproof` |
| `REDIS_CONNECTION_STRING` | Yes      | Redis connection string for BullMQ | `redis://localhost:6379`                                  |

### Cloudinary (file uploads)

| Variable                | Required | Purpose               |
| ----------------------- | -------- | --------------------- |
| `CLOUDINARY_CLOUD_NAME` | Yes      | Cloudinary cloud name |
| `CLOUDINARY_API_KEY`    | Yes      | Cloudinary API key    |
| `CLOUDINARY_API_SECRET` | Yes      | Cloudinary API secret |

### Identity/Verification Integrations

| Variable                    | Required | Purpose                   |
| --------------------------- | -------- | ------------------------- |
| `INTERSWITCH_BASE_URL`      | Yes      | Interswitch base URL      |
| `INTERSWITCH_CLIENT_ID`     | Yes      | Interswitch client ID     |
| `INTERSWITCH_CLIENT_SECRET` | Yes      | Interswitch client secret |

Note: current code returns mocked verification payloads in the Interswitch service layer, but these env keys are still expected by config construction.

### Messaging + Email

| Variable            | Required          | Purpose                         |
| ------------------- | ----------------- | ------------------------------- |
| `SMS_GATE_USERNAME` | Yes               | SMS Gate username               |
| `SMS_GATE_PASSWORD` | Yes               | SMS Gate password               |
| `MAILER_USERNAME`   | Feature-dependent | Gmail username for mail sending |
| `MAILER_PASSWORD`   | Feature-dependent | Gmail app password              |
| `MAILER_FROM`       | Optional          | Default sender label/address    |

`MAILER_*` values are required when email-sending flows are triggered.

### Payments + Redirects

| Variable                | Required | Purpose                                         |
| ----------------------- | -------- | ----------------------------------------------- |
| `SQUAD_SECRET_KEY`      | Yes      | Squad authorization secret                      |
| `SQUAD_BASE_URL`        | Yes      | Squad API base URL (sandbox or prod)            |
| `APP_BASE_URL`          | Yes      | API base URL used for callback links            |
| `CHECKOUT_REDIRECT_URL` | Yes      | Frontend URL for checkout verification redirect |
| `FRONTEND_URL`          | Yes      | Frontend base URL for rating/payment links      |

### OCR + Face Debug/Model Options

| Variable         | Required | Purpose                                           | Default           |
| ---------------- | -------- | ------------------------------------------------- | ----------------- |
| `OCR_DEBUG_DIR`  | Optional | Where OCR debug variants are saved in local mode  | `logs/ocr-debug`  |
| `FACE_DEBUG_DIR` | Optional | Where face debug variants are saved in local mode | `logs/face-debug` |
| `FACE_MODEL_DIR` | Optional | Directory containing face-api model files         | `src/models`      |

## Local Services Setup

### PostgreSQL

Create a database and make sure `DATABASE_URL` points to it.

Example:

```bash
createdb vendorproof
```

### Redis

Run Redis locally and verify:

```bash
redis-cli ping
```

Expected output:

```txt
PONG
```

## Worker Behavior

Queue workers are currently bootstrapped by queue module imports in the same runtime process as the API server. Running `npm run dev` starts both HTTP handling and queue consumption in one process.

## Important Seed Note

On startup, the server runs `runSeeds()`

## Common Development Flow

```bash
npm install
cp .env.sample .env
npx prisma generate
npx prisma db push
npm run dev
```

## Validation

Type-check/build check:

```bash
npm run build
```

## Troubleshooting

### App exits immediately with DB or Redis errors

- Verify `DATABASE_URL` and `REDIS_CONNECTION_STRING`.
- Ensure PostgreSQL and Redis are reachable.

### Swagger docs not visible

- Swagger is disabled when `NODE_ENV=production`.
- Use `NODE_ENV=local` or `development` to access `/api/docs`.

### Face matching fails to load models

- Ensure model files exist in `src/models`, or set `FACE_MODEL_DIR` correctly.

### Email sending fails

- Set `MAILER_USERNAME` and `MAILER_PASSWORD`.
- For Gmail, use an app password.

## Scripts

| Command         | Description                               |
| --------------- | ----------------------------------------- |
| `npm run dev`   | Start server with `nodemon` + `tsx`       |
| `npm run build` | Compile TypeScript to `dist`              |
| `npm start`     | Run compiled server from `dist/server.js` |

## License

ISC
