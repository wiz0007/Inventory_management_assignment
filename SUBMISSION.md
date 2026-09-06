# Submission

Fill this in and commit it. This is the first file we open.

## Links

- **GitHub repository:** https://github.com/wiz0007/Inventory_management_assignment
- **Live application:** https://inventory-management-assignment-tawny.vercel.app
- **Backend API:** https://inventory-control-api-6sgy.onrender.com

## Notes for the reviewer

The backend API is hosted on Render's free tier, which spins down after periods of inactivity. If waking from cold sleep, the first request may take ~50 seconds to respond. Subsequent requests respond in milliseconds. All demo accounts are pre-seeded in PostgreSQL on Supabase.

## Demo credentials

| Role | Email | Password |
|------|-------|----------|
| Inventory Manager (Global Access) | manager@distributor.com | Manager123! |
| Warehouse Staff (Main & North Depot) | staff1@distributor.com | Staff123! |
| Warehouse Staff (Downtown Retail) | staff2@distributor.com | Staff123! |

## Stack

| Layer | What you used | Why |
|-------|---------------|-----|
| Frontend | React (Vite) + TypeScript + Custom CSS/Tokens | Rapid modern SPA, responsive layouts, zero bloat, full TypeScript typing |
| Backend | Node.js + Express + TypeScript | Robust REST API, strict RBAC middleware, transactional ledger execution |
| Database | PostgreSQL (Supabase) + Prisma ORM | ACID transactions, row-level locking for atomic transfers, relational schema |
| Hosting | Supabase (DB) + Vercel / Render | Permanent free tiers, high availability, zero cold starts on DB |

## Goal checklist

Mark each honestly. Partial is fine — say what is partial.

| # | Goal | Status | Notes |
|---|------|--------|-------|
| 1 | Accounts and roles | Done | Manager vs Staff roles enforced on the server via JWT and RBAC middleware |
| 2 | Items | In progress | Schema ready, building in Sprint 2 |
| 3 | Stock movements | In progress | Schema ready, building in Sprint 3 |
| 4 | The stock ledger | In progress | Schema ready, building in Sprint 3 |
| 5 | Location assignment | Done | Many-to-many staff-location assignments, manager-only assignment control |
| 6 | | | |
| 7 | | | |
| 8 | | | |
| 9 | | | |
| 10 | | | |

## How much time did you actually spend?

## What would you do next, with another 12 hours?

## What are you least happy with in this codebase, and why?
