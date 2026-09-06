# Architecture

## What are the moving pieces, and how do they talk to each other?

The system is structured as a decoupled client-server architecture with an append-only relational ledger:

1. **Client (Single-Page Application):**
   - Built with React, TypeScript, and Vite.
   - Communicates with the backend exclusively via standard HTTP REST API endpoints using JSON payloads.
   - Includes client-side session management storing JWT tokens securely, dynamic UI states based on user roles (`MANAGER` vs. `STAFF`), interactive data tables, CSV import/export handlers, and analytical visualisations.

2. **Server (REST API & Business Logic Engine):**
   - Built with Node.js, Express, and TypeScript.
   - Houses the core business domain logic:
     - Authentication & Session Verification.
     - Role-Based Access Control (RBAC) middleware verifying that managers have global scope while warehouse staff are strictly scoped to their assigned locations.
     - Append-Only Stock Movement Engine verifying atomic transfers, preventing negative stock, and validating adjustment rationale.
     - Server-side query processor for multi-factor filtering, search, and dynamic sorting by ledger-derived quantities.
     - CSV parsing and validation pipeline with per-row failure isolation.

3. **Data Layer (PostgreSQL & Prisma ORM):**
   - Stores accounts, locations, staff assignments, categories, items, audit timelines, and the immutable stock ledger.
   - Enforces referential integrity through foreign keys, uniqueness constraints (SKU, location codes, category names), and transaction isolation levels (`SERIALIZABLE` / row locking) to prevent race conditions.

```mermaid
flowchart TD
    subgraph Browser ["Client (Browser)"]
        UI[React + Vite UI]
        State[Auth & UI State]
    end

    subgraph Backend ["Server (Node.js / Express)"]
        API[REST API Gateway]
        AuthMid[Auth & RBAC Middleware]
        LedgerService[Append-Only Ledger Engine]
        QueryService[Server-Side Query & Aggregation]
    end

    subgraph Database ["Data Store (PostgreSQL)"]
        DB[(PostgreSQL Database)]
        LedgerTable[("stock_movements (Append-Only)")]
        ItemTable[("items & categories")]
        UserTable[("users & user_locations")]
    end

    UI -->|HTTPS / REST JSON| API
    API --> AuthMid
    AuthMid --> LedgerService
    AuthMid --> QueryService
    LedgerService -->|ACID Transactions| LedgerTable
    LedgerService --> ItemTable
    QueryService -->|Dynamic SUM Aggregation| DB
```

---

## Where does each piece run?

- **Client:** Runs in the end-user's web browser as static assets compiled by Vite and hosted on Vercel.
- **Server:** Runs as an Express.js HTTP process on Render (or a cloud container environment).
- **Database:** Runs as a managed PostgreSQL instance on Supabase / Neon with automated backups, SSL connections, and connection pooling.

---

## What is the request path for one representative user action, end to end?

### Representative Action: Recording an Inter-Location Stock Transfer
*A warehouse staff member transfers 20 units of "10mm Copper Pipe" from "Warehouse A" to "Retail Floor B".*

1. **Client Submission:**
   - Staff selects the item, destination location, and quantity (20) in the Stock Movement modal and clicks "Confirm Transfer".
   - Client sends `POST /api/movements/transfer` with `{ itemId, sourceLocationId, destinationLocationId, quantity: 20 }` and `Authorization: Bearer <token>`.

2. **Server Middleware Pipeline:**
   - `requireAuth` parses and verifies the JWT, retrieving the user record and their assigned locations.
   - `requireLocationPermission` checks if the user is a `MANAGER` or if `sourceLocationId` is in the user's `assignedLocationIds`. If the staff member is not assigned to "Warehouse A", the request immediately terminates with `403 Forbidden`.

3. **Input Validation:**
   - Zod schema validates that `quantity` is a positive integer, `sourceLocationId != destinationLocationId`, and all IDs are valid UUIDs.

4. **Transactional Execution & Concurrency Lock:**
   - Inside a Prisma/PostgreSQL `$transaction`:
     - Locks the item's ledger records for the source location (`SELECT ... FOR UPDATE`).
     - Derives current on-hand stock at "Warehouse A":
       $$\text{Stock}_{\text{Source}} = \sum (\text{Receipts} + \text{Inbound Transfers}) - \sum (\text{Issues} + \text{Outbound Transfers}) \pm \text{Adjustments}$$
     - If $\text{Stock}_{\text{Source}} < 20$, the server aborts the transaction and returns `400 Bad Request` ("Insufficient stock at source location").
     - If valid, inserts an append-only row into `stock_movements` with `type = 'TRANSFER'`, `quantity = 20`, `sourceLocationId`, `destinationLocationId`, and `userId`.

5. **Response & Client Update:**
   - Server commits the transaction and responds with `201 Created` and the created ledger entry.
   - Client invalidates the cache for the item's ledger and updates the stock badge without full page reload.

---

## What did you decide *not* to build, and why?

1. **Direct `on_hand` Column in the `items` Table:**
   - *Decision:* Rejected storing a cached `quantity_on_hand` counter in `items` that gets incremented/decremented.
   - *Why:* Storing a mutable balance invites drift and synchronization bugs during concurrent writes or server crashes. Requirement 4 explicitly mandates that on-hand quantity is **never** stored or edited directly, but always derived from the append-only ledger entries.
2. **WebSockets for Real-time Streaming:**
   - *Decision:* Used standard HTTP REST requests with targeted query refetching instead of persistent WebSocket connections.
   - *Why:* Stock movements in this warehouse scenario occur on discrete user actions (receiving, picking, shipping). WebSockets would add stateful connection overhead on serverless/cloud platforms without tangible benefit over clean REST polling or invalidation.
3. **Complex Multi-Step Wizard for Movements:**
   - *Decision:* Built unified, rapid-entry movement modals instead of multi-page wizards.
   - *Why:* Warehouse operators prioritize fast data entry. Single-view contextual dialogs with keyboard-friendly inputs minimize operational friction.
