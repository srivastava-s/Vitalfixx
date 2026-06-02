# VitalFix 🧾

**Web performance intelligence platform — audit, fix, and monitor Core Web Vitals from a single dashboard.**

## Overview

VitalFix is a one-stop performance dashboard for developers and teams. It combines Lighthouse scores, CrUX field data, and actionable code fixes into a single, affordable platform. Whether you are an indie dev looking for quick, copy-paste fixes or a team lead needing API integrations, CI/CD pipelines, and performance budgets, VitalFix provides the necessary tools without the enterprise APM suite price tag.

## Core Features

- **Lighthouse Audit Engine:** Uses Google PageSpeed Insights API with a custom fallback to provide Lighthouse scores and Core Web Vitals (CWV) metrics.
- **8-Module Custom Site Audit:** Checks for broken links, image optimization, asset sizing, meta tags, accessibility, security, and more.
- **Health Score:** A combined score calculating your Lighthouse Performance and Custom Audit Score.
- **Scan History + Trends:** Keep track of per-URL audit history, compare side-by-side diffs, and view sparklines of performance trends.
- **Export Engine:** Export your reports as JSON, CSV, or branded PDFs.
- **REST API:** Integrate audits into your workflow with rate-limited, API-key authenticated endpoints.
- **Shareable Reports:** Generate public URLs containing snapshots of your audit data.

## Tech Stack

- **Frontend:** Next.js 14 (App Router), React 18, Tailwind CSS, Lucide React icons
- **Backend:** Next.js API Routes (Serverless)
- **Database & Auth:** Supabase (PostgreSQL + Auth + RLS)
- **Payments:** Stripe (Subscriptions + Webhooks)
- **Audit Engine:** Google PSI API + Cheerio-based crawler
- **Testing:** Vitest (Unit Tests), Playwright (E2E Tests)
- **Monitoring:** Sentry

## Getting Started

### Prerequisites

Ensure you have Node.js and `pnpm` installed. We use `pnpm` exclusively for dependency management.

### Installation

1. Clone the repository:

   ```bash
   git clone <repository-url>
   cd vitalfix
   ```

2. Install dependencies:

   ```bash
   pnpm install
   ```

3. Set up environment variables:

   Copy the `.env.example` to `.env.local` and fill in your variables:

   ```bash
   cp .env.example .env.local
   ```

### Development

Start the development server:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Scripts

- `pnpm dev`: Starts the Next.js development server.
- `pnpm build`: Builds the application for production.
- `pnpm start`: Starts the Next.js production server.
- `pnpm lint`: Runs ESLint to check for linting errors.
- `pnpm type-check`: Runs TypeScript compiler check.
- `pnpm test`: Runs Vitest for unit tests.
- `pnpm test:watch`: Runs Vitest in watch mode.
- `pnpm test:e2e`: Runs Playwright for end-to-end tests.
