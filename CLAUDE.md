# Billing App — Agent Configuration

## Sub-Agents (run in parallel)
- **frontend-agent**: Handles all React/UI components and dashboard
- **backend-agent**: Handles API routes, business logic, cron jobs
- **database-agent**: Handles schema, migrations, queries
- **integration-agent**: Handles Stripe, Outlook, email automation

## Parallelization Rules
- Frontend and Backend agents work simultaneously
- Database agent runs first, others depend on schema
- Integration agent runs after backend routes exist
- Each agent commits to its own git branch, merge at end

## Stack
- Frontend: Next.js 14, Tailwind CSS, shadcn/ui
- Backend: Next.js API routes + Node.js
- Database: PostgreSQL + Prisma ORM
- Email: Microsoft Graph API (Outlook shared inbox)
- Payments: Stripe
- Scheduling: node-cron
- Auth: NextAuth.js
- Hosting: ready for Vercel + Railway

## Commands
- Dev: npm run dev
- DB migrate: npx prisma migrate dev
- DB studio: npx prisma studio