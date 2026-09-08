# Submission

Fill this in and commit it. This is the first file we open.

## Links

- **GitHub repository:** https://github.com/wiz0007/Inventory_management_assignment
- **Live application:** https://inventory-management-assignment-tawny.vercel.app
- **Backend API:** https://inventory-control-api-6sgy.onrender.com

## Notes for the reviewer

The backend API is hosted on Render's free tier, which spins down after periods of inactivity. If waking from cold sleep, the first request may take ~50 seconds to respond. Subsequent requests respond in milliseconds. All demo accounts are pre-seeded in PostgreSQL on Supabase with 8 weeks of historical ledger activity.

A convenient **1-click demo role switcher** is built directly into the top navigation bar, allowing immediate switching between:
- **Elena Rostova (Manager)**: Full global authority across all warehouses, catalog items, categories, adjustments, staff assignments, and alerts.
- **Marcus Vance (Staff 1)**: Assigned to *Main Distribution Warehouse* (`WH-MAIN`) and *Northside Transit Depot* (`WH-NORTH`).
- **Sarah Chen (Staff 2)**: Assigned to *Downtown Retail Store* (`STORE-01`) only.

The application also features full client-side URL routing via `react-router-dom` (`/dashboard`, `/items`, `/movements`, `/locations`, `/import-export`, `/alerts`), supporting native browser Back/Forward navigation, refresh persistence, and deep-linking.

## Demo credentials

| Role | Email | Password | Assigned Locations |
|------|-------|----------|--------------------|
| Inventory Manager (Global Access) | manager@distributor.com | Manager123! | All locations (Global scope) |
| Warehouse Staff (Main & North Depot) | staff1@distributor.com | Staff123! | Main Warehouse (`WH-MAIN`), Northside Transit Depot (`WH-NORTH`) |
| Warehouse Staff (Downtown Retail) | staff2@distributor.com | Staff123! | Downtown Retail Floor (`STORE-01`) |

## Stack

| Layer | What you used | Why |
|-------|---------------|-----|
| Frontend | React 19 (Vite) + TypeScript + React Router v7 + Scoped CSS Modules | Responsive SPA, full browser history traversal, deep linking, zero third-party chart bloat (pure SVG), fluid layouts down to 320px |
| Backend | Node.js + Express + TypeScript | REST API with strict RBAC middleware, atomic transaction isolation, streaming CSV parser, and sanitized error responses |
| Database | PostgreSQL (Supabase) + Prisma ORM | ACID transactions, row-level concurrency locks (`SELECT ... FOR UPDATE`), check constraints, and append-only ledger math |
| Hosting | Supabase (DB) + Vercel (Client) + Render (API) | Cloud deployment with automated CI/CD builds on PR merge |

## Goal checklist

Mark each honestly. Partial is fine — say what is partial.

| # | Goal | Status | Notes |
|---|------|--------|-------|
| 1 | Accounts and roles | Done | Manager vs Staff roles enforced on the server via signed `httpOnly` JWT cookies and RBAC middleware; client reflects permissions dynamically |
| 2 | Items | Done | Unique SKU, managed Category taxonomy, UOM, Reorder thresholds, and soft archiving (blocks movements against archived items while preserving ledger history) |
| 3 | Stock movements | Done | Append-only ledger supporting receipts, issues, transfers, and adjustments with actor, timestamp, and location tracking; full item timeline view |
| 4 | The stock ledger | Done | Purely derived on-hand quantity (never stored); atomic inter-location transfers in a single indivisible transaction; strict negative-stock guards; mandatory adjustment reasons |
| 5 | Location assignment | Done | Many-to-many staff-to-location assignments; manager-only assignment control; server-side enforcement blocking staff from acting at unassigned facilities |
| 6 | Search, filtering and pagination | Done | Server-side text search (name/SKU/desc), multi-criteria filters (category, location, archived, low-stock), derived balance sorting, and pagination with exact total match counts |
| 7 | Bulk import and export | Done | Fault-tolerant CSV bulk engine with partial success & per-row diagnostic failure reports for items & receipts (enforcing staff location RBAC per row) + live stock position CSV export |
| 8 | Visualizations | Done | Operational dashboard with 4 headline KPIs, pure SVG Category Donut chart with dynamic center stats on hover, warehouse capacity bars, and 8-week movement volume velocity chart (Inflow vs Outflow) |
| 9 | Audit timeline | Done | Immutable append-only audit trail (`item_timeline`) recording item creation, attribute diffs (old/new value + user), and staff notes; database rules block UPDATE/DELETE |
| 10 | Low-stock alerts | Done | Multi-location reorder evaluation with real-time navbar counter, manager-only dismissal, and chronological post-dismissal balance re-arming state machine |

## How much time did you actually spend?

Total time spent was **~12.5 hours**, executed as a disciplined 7-sprint engineering progression across 6 days (~1.5 to 2 hours per session):

1. **Sprint 0: Architecture, Monorepo & Relational Baseline (~1.0h)**:
   Repository initialization, monorepo structure (`/client`, `/server`), PostgreSQL Prisma schema modeling, and initial documentation suite in `docs/`.
2. **Sprint 1: Accounts, Roles & Location RBAC (~1.5h)**:
   JWT authentication with signed `httpOnly` cookies, CSRF defense headers, server-side RBAC middleware, many-to-many staff location assignments, and 1-click demo account switcher.
3. **Sprint 2: Item Catalog, Categories & Immutable Audit Timeline (~1.5h)**:
   Manager-governed category taxonomy, unique SKU catalog, soft-archiving movement guards, and the immutable append-only `item_timeline` tracking attribute diffs and staff notes.
4. **Sprint 3: The Stock Ledger & Atomic Movement Engine (~2.5h)**:
   Append-only transactional ledger, purely derived on-hand calculations, indivisible inter-location transfers inside PostgreSQL transactions, negative-stock prevention, and mandatory adjustment reason validation.
5. **Sprint 4: Server-Side Querying, Filtering & Pagination (~2.0h)**:
   Raw SQL CTE optimization for server-side text search (`ILIKE`), multi-criteria filters, sorting by derived on-hand balance, and exact boundary pagination.
6. **Sprint 5: Bulk CSV Engine & Low-Stock Alerts Re-Arming (~2.0h)**:
   Streaming CSV parser with per-row failure reports and partial success for items and receipts; live stock CSV export; low-stock alert trigger with manager dismissal and post-dismissal chronological balance re-arming.
7. **Sprint 6: Analytics Dashboard, 8-Week Seed Data & Visualizations (~1.5h)**:
   8-week realistic backdated movement generator; backend aggregation endpoints; pure SVG Donut and 8-week dual-series movement velocity charts; responsive mobile layout fixes.
8. **Sprint 7 & Routing: Client-Side Routing Architecture & Review Pack (~0.5h)**:
   `react-router-dom` integration with dedicated `allRoutes.tsx` module, browser Back/Forward traversal, deep-linking, final documentation audit, and regression testing.

## What would you do next, with another 12 hours?

If granted another 12 hours, I would focus on extending operational warehouse throughput and enterprise integration:

1. **Physical Cycle Counts & Ledger Reconciliation Workflow (Priority 1)**:
   Build a structured physical count audit module where warehouse workers enter actual shelf counts by location. The system would compute variances against the ledger-derived balance, require manager sign-off with mandatory rationale, and automatically post compensating `ADJUSTMENT` ledger entries to reconcile discrepancy.
2. **Batch / Lot & Expiry Date Tracking (Priority 2)**:
   Extend `stock_movements` with optional `lotNumber` and `expirationDate` attributes. Implement FIFO (First In, First Out) and FEFO (First Expired, First Out) pick-recommendations to prevent spoilage and support traceability for regulated goods.
3. **Hardware & Mobile Camera Barcode/QR Scanning (Priority 3)**:
   Integrate browser camera scanning (e.g. via `@zxing/library`) into the receipt and transfer modals, enabling instant SKU scanning on mobile devices without manual typing.
4. **Automated Low-Stock Email Alerts & Webhooks (Priority 4)**:
   Add asynchronous email notifications (via Resend or AWS SES) when low-stock alerts re-arm, and outbound webhooks (`stock.low`, `stock.movement.created`) to synchronize inventory with external eCommerce or accounting platforms.
5. **Nightly Balance Snapshots / Materialized Rollups (Priority 5)**:
   For long-term scalability past $10^6$ ledger rows, implement an automated nightly snapshot job that pre-aggregates closing balances, capping the real-time derivation window to the current day's movements.

## What are you least happy with in this codebase, and why?

1. **Prisma ORM Limitations on Derived Ledger Aggregations**:
   - Because Requirement 4 strictly dictates that on-hand stock is *never* stored as a mutable counter column, computing inventory balances requires aggregating ledger movements (`SUM(CASE WHEN destination = loc THEN qty ELSE -qty END)`) and sorting items by that derived sum.
   - Prisma's high-level query builder lacks support for dynamic aggregate joins in its `findMany` API. To achieve performant sorting, filtering, and exact pagination entirely on the database, we had to write raw PostgreSQL Common Table Expressions (`prisma.$queryRaw`). While raw SQL is blazing fast and utilizes database indexes effectively, it bypasses Prisma's compile-time type safety for those specific queries, meaning changes to column names are not caught by `tsc`.
2. **Render Free-Tier Cold Sleep Latency**:
   - To adhere to the zero-cost hosting requirement, the backend is deployed on Render's free tier. While the PostgreSQL database on Supabase never sleeps, Render spins down web services after 15 minutes of inactivity. When a reviewer opens the app after an idle period, the initial request takes ~50 seconds to boot up. While subsequent requests respond in under 50ms, in a paid production setup this would be hosted on an always-on container or serverless edge with warmers.
3. **Single Location Scope for Staff Login Sessions**:
   - Currently, staff permissions are evaluated per transaction against the `user_locations` join table. While this allows staff members assigned to multiple depots to switch contexts easily, the UI presents all assigned locations in dropdowns rather than having an explicit "Active Warehouse Site" context switcher, which can lead to accidental selection of the wrong warehouse during high-velocity data entry.
