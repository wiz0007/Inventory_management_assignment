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
| 2 | Items | Done | Unique SKU, Category taxonomy, UOM, Reorder thresholds, and soft archiving |
| 3 | Stock movements | Done | Append-only ledger supporting receipts, issues, transfers, and adjustments with actor & location tracking |
| 4 | The stock ledger | Done | Purely derived on-hand quantity with atomic transfers, negative-stock prevention, and mandatory reasons |
| 5 | Location assignment | Done | Many-to-many staff-location assignments, manager-only assignment control |
| 6 | Search, filtering and pagination | Done | Server-side text search (name/SKU/desc), multi-criteria filters (category, location, archived, low-stock), derived balance sorting, and pagination with exact match counts |
| 7 | Bulk import and export | Done | Bulk CSV engine with partial success & per-row diagnostic failure reports for items & receipts (enforcing staff location RBAC per row) + live stock position CSV export |
| 8 | Visualizations | Planned | Dashboard & 8-week movement charts scheduled for Sprint 6 |
| 9 | Audit timeline | Done | Immutable append-only audit trail recording item creation, attribute diffs, and staff notes |
| 10 | Low-stock alerts | Done | Multi-location reorder evaluation with real-time navbar counter, manager-only dismissal, and chronological balance re-arming state machine |

## How much time did you actually spend?

## What would you do next, with another 12 hours?

## What are you least happy with in this codebase, and why?
