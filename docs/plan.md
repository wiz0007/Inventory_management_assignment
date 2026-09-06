# Plan

## How did you break the work into sessions?

We structured the 12-hour budget across 7 focused engineering sessions (sprints), dedicating roughly 1.5 to 2 hours per session:

- **Session 1 (Sprint 0): Setup & Architecture Baseline:** Git repository setup, monorepo layout (`/client` and `/server`), Prisma schema definition, and architectural documentation.
- **Session 2 (Sprint 1): Accounts, Roles & Location Permissions (Req 1 & 5):** JWT authentication, RBAC middleware, location assignments, and security boundaries.
- **Session 3 (Sprint 2): Items, Categories & Immutable Audit Timeline (Req 2 & 9):** Product catalog, category management, archiving mechanisms, and append-only change logs.
- **Session 4 (Sprint 3): The Stock Ledger & Atomic Movement Engine (Req 3 & 4):** Append-only movement engine, derived stock calculations, negative-stock prevention, and atomic inter-location transfers.
- **Session 5 (Sprint 4): Server-Side Querying & Pagination (Req 6):** High-performance SQL queries for text search, multi-factor filtering, and sorting by derived balances.
- **Session 6 (Sprint 5): CSV Engine & Low-Stock Alerts (Req 7 & 10):** Fault-tolerant CSV imports with per-row failure isolation, stock export, and alert dismissal with the re-arming state machine.
- **Session 7 (Sprint 6 & 7): Dashboard Analytics & Final Review (Req 8 + Docs):** Operational KPI dashboard, charts, realistic 8-week seed data generation, and end-to-end verification.

---

## What order did you build in, and why that order?

We followed an **inside-out, dependency-first order**:

1. **Schema & Ledger First:** In an inventory system, the stock ledger is the beating heart. If the ledger schema or movement math has flaws, every feature built on top (search, dashboards, alerts, exports) inherits those flaws.
2. **Access Control & RBAC Next:** Security and location constraints were established early so that every subsequent API endpoint was tested against real permission guards rather than tacked on at the end.
3. **Core CRUD & Catalog:** Items and categories were required before any stock movements could be recorded.
4. **Movements & Ledger Derivations:** Once items existed, receipts, issues, transfers, and adjustments were implemented with ACID transactions.
5. **Search, Filter & Sorting:** Built after movements so we had real ledger records to test server-side sorting by on-hand quantity.
6. **Bulk Operations & Alerts:** Built once single-item operations and ledger rules were completely validated.
7. **Dashboard & Visualizations:** Built last because aggregate metrics and weekly trend charts depend on having realistic, multi-week movement records.

---

## What did you estimate versus what it actually took?

| Component / Task | Estimated Time | Actual Time | Notes / Variances |
|---|---|---|---|
| Project Setup & Monorepo Configuration | 1.0 h | 1.0 h | Vite + Express setup was straightforward. |
| Schema Design & Prisma Setup | 1.5 h | 1.5 h | Designing the unified transfer schema upfront paid off. |
| Auth & Location-scoped RBAC | 1.5 h | 1.5 h | Needed careful testing for staff location boundary checks. |
| Stock Ledger & Atomic Transfer Math | 2.5 h | 2.5 h | Required concurrency locks (`SELECT ... FOR UPDATE`) to prevent race conditions. |
| Server-Side Search, Filter & Sort | 2.0 h | 2.0 h | Sorting by derived aggregate quantity required careful SQL CTE / group queries. |
| CSV Import/Export with Partial Error Reports | 1.5 h | 1.5 h | Streaming CSV row-by-row parsing with individual validation. |
| Low-Stock Alert Re-arming Logic | 1.0 h | 1.0 h | Re-arming state transition required testing against multiple stock rise/fall cycles. |
| Dashboard & 8-Week Trends | 1.5 h | 1.5 h | Aggregating 8 weeks of receipts vs. issues grouped by ISO week. |
| Documentation & Seed Data | 1.5 h | 1.5 h | Completed documentation files and generated rich realistic seed data. |

---

## What did you cut when you ran short?

1. **Optional Stretch Features:** We deliberately focused all 12 hours on nailing the **10 core requirements** with 100% fidelity before considering any stretch features (like barcode lookup or supplier records). As the brief noted: *"Doing 8 goals well beats doing 10 goals badly."*
2. **Complex UI Framework Overheads:** Avoided heavyweight UI component libraries with massive configuration footprints, choosing a clean, tailored design system with Tailwind CSS and Lucide icons that renders instantly and has zero runtime bloat.
3. **Multi-Step Transfer Approval Workflows:** Transferring stock directly records the movement rather than creating a "Draft $\rightarrow$ In-Transit $\rightarrow$ Received" state machine, which was not requested in the core brief.
