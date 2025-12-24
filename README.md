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
- Node.js 18+
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

## License

Private - All Rights Reserved
# Trigger Netlify rebuild
