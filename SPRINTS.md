# Software Engineering Workflow & Sprint Tracker

This document tracks the procedural lifecycle, sprint progress, architectural standards, and CI/CD deployment milestones for the **Inventory & Stock Control** system.

---

## 🚀 Sprint Progress Tracker

| Sprint | Milestone / Scope | Target Req. | Dedicated Branch | Status |
|---|---|---|---|---|
| **Sprint 0** | Architecture Baseline, Monorepo Setup & Docs | Setup | `main` | ✅ **COMPLETED** |
| **Sprint 1** | Accounts, Roles & Location RBAC Enforcement | Req 1, 5 | `sprint-1-auth-locations` | ✅ **COMPLETED** *(Merged into `main`)* |
| **Sprint 2** | Item Catalog, Categories & Immutable Audit Timeline | Req 2, 9 | `sprint-2-items-catalog` | ✅ **COMPLETED** |
| **Sprint 3** | Append-Only Stock Ledger & Atomic Movement Engine | Req 3, 4 | `sprint-3-stock-ledger` | ✅ **COMPLETED** |
| **Sprint 4** | Server-Side Querying, Filtering & Pagination | Req 6 | `sprint-4-search-pagination`| ⏳ **IN PROGRESS** |
| **Sprint 5** | Bulk CSV Import/Export & Low-Stock Alerts Engine | Req 7, 10| `sprint-5-csv-alerts` | 📋 *Backlog* |
| **Sprint 6** | Operational Dashboard & 8-Week Analytics Charts | Req 8 | `sprint-6-dashboard-charts`| 📋 *Backlog* |
| **Sprint 7** | Seed Data, Documentation & Production Deployment | Review | `sprint-7-final-polish` | 📋 *Backlog* |

---

## 📋 Sprint Details & Verification Checklist

### Sprint 0: Architecture Baseline & Foundation
- [x] Git repository initialized and linked to GitHub (`origin main`).
- [x] Monorepo structure configured (`/client` for Vite+React, `/server` for Express+TS).
- [x] Relational schema designed in Prisma with PostgreSQL.
- [x] Initialized the 5 mandatory docs in `docs/` (`architecture.md`, `schema.md`, `plan.md`, `decisions.md`, `ai-prompts.md`).
- [x] Zero-warning build verification on client and server.

### Sprint 1: Accounts, Roles & Location RBAC (Req 1 & 5)
- [x] JWT authentication with bcrypt password hashing (`/api/auth/register`, `/api/auth/login`, `/api/auth/me`).
- [x] Hardened `httpOnly` cookie session management with `SameSite=Lax` (immune to XSS token theft).
- [x] Anti-CSRF protection via custom `X-Requested-With: StockPulse-Client` header and origin verification.
- [x] Server-side RBAC middleware (`requireAuth`, `requireRole('MANAGER')`, `requireLocationPermission`).
- [x] Many-to-many Staff $\leftrightarrow$ Location assignment engine (`/api/locations/:id/assign-staff`).
- [x] Automated test suite verifying 403 blocks for unauthorized staff locations (`server/src/test-sprint1.ts`).
- [x] Frontend Login page with 1-click demo role switcher (Elena Manager, Marcus Staff 1, Sarah Staff 2).
- [x] Frontend Locations & Staff management page.
- [x] Updated `SUBMISSION.md` with demo credentials.

### Sprint 2: Items, Categories & Immutable Audit Timeline (Req 2 & 9)
- [x] Category management API (Manager-only CRUD with item count guards).
- [x] Item catalog API: SKU (unique), name, description, unit of measure, reorder level, category.
- [x] Item archiving and restoration: blocks new stock movements against archived items while preserving full history.
- [x] Immutable Audit Timeline (`item_timeline` table): tracks creation, every field change (with old/new values and user), and staff notes. Database rules block `UPDATE`/`DELETE`.
- [x] Frontend Inventory Catalog UI: Item cards/tables, creation modal, edit modal, archive switch, and full timeline view.

### Sprint 3: The Stock Ledger & Movement Engine (Req 3 & 4)
- [x] Append-only `stock_movements` ledger: receipts, issues, transfers, adjustments.
- [x] Strictly derived on-hand calculations (no stored balance column; always dynamically summed).
- [x] Atomic inter-location transfers: single indivisible operation wrapped in a PostgreSQL transaction with row locks.
- [x] Negative-stock guard: server rejects any transfer or issue driving source stock negative.
- [x] Mandatory reason validator for adjustments (rejected without non-empty explanation).
- [x] Item movement history view in chronological order.
- [x] Automated test suite verifying ledger math, transfers, negative stock rejection, and reason validation (`server/tests/test-sprint3.ts`).
- [x] Responsive Frontend Movements Ledger and interactive Record Movement modal with live stock availability.

### Sprint 4: Server-Side Querying, Filtering & Pagination (Req 6)
- [ ] Server-side text search over item name and SKU.
- [ ] Multi-criteria filters: category, location, archived state, at-or-below-reorder.
- [ ] Server-side sorting: by name, reorder level, or dynamically derived on-hand quantity.
- [ ] Server-side pagination with exact match counts.

### Sprint 5: Bulk CSV Engine & Low-Stock Alerts (Req 7 & 10)
- [ ] CSV bulk import for items with per-row failure reports and partial success.
- [ ] CSV bulk import for stock receipts with per-row failure reports and partial success.
- [ ] CSV export of current stock position (on-hand by location).
- [ ] Low-stock alert trigger: total on-hand $\le$ reorder level across all locations.
- [ ] Global navigation badge count.
- [ ] Manager alert dismissal with **re-arming state machine** (reappears if stock rises above and drops back below reorder level).

### Sprint 6: Analytics Dashboard & Visualizations (Req 8)
- [ ] 4 Headline KPI cards: Active Items, Items $\le$ Reorder Level, Movements Today, Distinct Items Moved This Week.
- [ ] Stock breakdown by category (donut/pie visualization).
- [ ] Stock breakdown by warehouse location (bar visualization).
- [ ] 8-week movement volume trend: time-series chart of receipts vs. issues grouped by week.

### Sprint 7: Production Deployment & Review Pack
- [ ] Realistic 8-week historical seed data generation.
- [ ] Finalize the 5 documentation files in `docs/`.
- [ ] Deploy backend to Render and frontend to Vercel with automated CI/CD.
- [ ] Complete `SUBMISSION.md` with live URLs and reviewer notes.

---

## 🏛️ The Software Engineering Approach Explained

We adhere to a **Disciplined Agile Lifecycle** that mirrors senior engineering standards:

1. **Sprint Branch GitFlow with Pull Requests:**
   - Every sprint has its own isolated branch (e.g. `sprint-1-auth-locations`).
   - Work is committed incrementally with **Conventional Commits** (`feat(...)`, `fix(...)`, `docs(...)`).
   - Code is merged into `main` via GitHub Pull Requests, leaving an auditable review trail.
2. **Domain-Driven, Dependency-First Progression:**
   - In financial and stock systems, **data integrity is paramount**. We build the relational schema and transactional ledger first, followed by APIs, then the UI, and finally reporting dashboards.
3. **Defense in Depth (Server-Side Enforcement):**
   - Business rules and security are enforced at the database level (constraints, transactions, row locks) and backend middleware, never trusting the client browser.
4. **Automated Verification per Milestone:**
   - Each sprint includes an automated verification script that tests domain constraints against the live database before the sprint is marked complete.
5. **Living Documentation:**
   - As mandated by the assignment, documentation (`docs/`) is written concurrently during implementation, reflecting real architectural decisions and trade-offs.

---

## ⚙️ CI/CD Pipelines & Hosting Strategy

### 1. Should you set up a GitHub Actions CI Pipeline?
**Yes, strongly recommended!**
- A lightweight GitHub Actions workflow (`.github/workflows/ci.yml`) runs on every Pull Request to verify that both `client` and `server` compile with zero TypeScript errors.
- It provides a green checkmark on every PR, proving to the reviewer that the codebase is continuously integrated and error-free.

### 2. When to Host on Vercel and Render?
- **Recommended Timing:** Right now or after **Sprint 3**.
- Connecting Vercel (for `/client`) and Render (for `/server`) early is advantageous:
  - Both Vercel and Render connect directly to your GitHub repository.
  - Whenever you merge a Sprint PR into `main`, **Vercel and Render automatically build and deploy the new version without any manual effort**.
  - This guarantees that deployment issues (e.g. environment variables or build commands) are resolved early rather than in a stressful rush at the deadline.
