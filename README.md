# Tribe Discovery

A standalone Next.js app for a personality-first social discovery platform. The first screen is the product workspace: match filters, personality signals, profile cards, circle overlap, shared values, and conversation prompts.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

Main app files:

- `src/app/page.tsx` contains the interactive discovery interface.
- `src/app/globals.css` contains global Tailwind and base app styles.
- `public/avatars` contains local profile artwork used by the match cards.

## Scripts

- `npm run dev` starts local development.
- `npm run build` creates a production build.
- `npm run lint` runs ESLint.

## Stack

Next.js App Router, React, TypeScript, Tailwind CSS, and lucide-react icons.
