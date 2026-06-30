# MyKosherDelivery

A modern food delivery platform specializing in kosher cuisine.

## Tech Stack

- **Frontend**: React 18, Vite, SCSS
- **Backend**: Node.js, Express, PostgreSQL
- **Payment**: Stripe
- **Delivery**: Shipday
- **Deployment**: Railway

## Setup

### Prerequisites
- Node.js 24 LTS (20+ supported locally; see `.nvmrc`)
- PostgreSQL 14+

### Installation

```bash
# Install dependencies
npm install
cd backend && npm install

# Set up environment variables
cp backend/env.example backend/.env
cp .env.example .env

# Run migrations
cd backend && npm run migrate

# Start development servers
npm run dev          # Frontend (port 5173)
cd backend && npm run dev  # Backend (port 3001)
```

## Environment Variables

See `backend/env.example` for required backend variables.
See `.env.example` for required frontend variables.

## Deployment (Heroku)

Formatted deploy output with preflight checks:

```bash
npm run deploy              # git push heroku main
npm run deploy:migrate      # deploy + run production migrations
npm run migrate:heroku      # migrations only (formatted output)
npm run logs:heroku         # tail Heroku logs
```

Production migrations:

```bash
heroku run npm run migrate --app mykosherdelivery
```

`npm run migrate:heroku` runs the same command with formatted output.

You can still use `git push heroku main` directly; the npm scripts wrap it with clearer sections, colors, and a summary.

## License

Private - All Rights Reserved
