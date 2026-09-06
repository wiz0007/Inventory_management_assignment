# Decisions

Log the decisions that actually shaped this codebase — the ones where a real alternative existed and you picked one.

---

## Decision 1: Relational PostgreSQL vs. Document Database (MongoDB)

- **Chose:** PostgreSQL with Prisma ORM.
- **Rejected:** MongoDB / Document Database (MERN stack).
- **Why:** The core domain is an inventory ledger that functions like a financial double-entry ledger. It strictly requires ACID transactions, check constraints, foreign keys to prevent orphaned records, and complex server-side aggregations (`SUM` with `GROUP BY` and dynamic sorting). In MongoDB, enforcing referential integrity and guaranteeing that concurrent transfers never drive stock negative requires complex multi-document transaction gymnastics, while in Postgres it is natively handled with row locks (`SELECT ... FOR UPDATE`).

---

## Decision 2: Representation of Inter-Location Stock Transfers

- **Chose:** A single atomic row in `stock_movements` carrying both `sourceLocationId` and `destinationLocationId`.
- **Rejected:** Creating two paired movement records (one outbound `ISSUE` from Location A and one inbound `RECEIPT` at Location B) linked by a correlation ID.
- **Why:** Requirement 4 mandates that a transfer must be a "single indivisible operation". Representing it as two separate rows introduces the risk of orphan records if a failure occurs between the two writes, or double-counting if a query forgets to join the correlation ID. A single row makes the transfer inherently indivisible at the schema level.
- **Later reversed:** In our initial design draft, we planned to model transfers as two linked records (`OUTBOUND_TRANSFER` and `INBOUND_TRANSFER`) to make location-based summing simpler. We reversed this decision after realizing that any failure between the two operations leaves the warehouse count permanently unbalanced — exactly the failure mode described in the assignment scenario! Switching to a single unified transfer row guarantees that stock leaving one location and arriving at the other is physically indivisible.

---

## Decision 3: Pure Ledger Derivation vs. Cached On-Hand Balance Column

- **Chose:** Deriving current on-hand quantity entirely at query time via `SUM(...)` across ledger rows.
- **Rejected:** Maintaining an `on_hand_quantity` integer column on the `items` or `locations` table that gets incremented/decremented on every movement.
- **Why:** Requirement 4 specifically states: *"An item's on-hand quantity is never stored or edited directly — it is always derived by summing its ledger entries."* Storing a running balance creates two sources of truth that inevitably drift apart over time. Calculating on the fly guarantees 100% mathematical consistency with the ledger.

---

## Decision 4: Server-Side RBAC & Location Enforcement vs. UI-Only Disabling

- **Chose:** Strict middleware enforcement (`requireAuth`, `requireRole`, and `requireLocationPermission`) on every sensitive API route.
- **Rejected:** Relying on frontend permission checks or hiding buttons in the navigation.
- **Why:** Requirement 1 and 5 explicitly demand that permission differences between managers and staff must be enforced on the server. If a staff member bypasses the UI and posts directly to `/api/movements` for a location they are not assigned to, or attempts to call `/api/items` to create or archive a product, the server immediately rejects the request with HTTP 403 Forbidden.

---

## Decision 5: Row-by-Row Fault-Tolerant CSV Import vs. All-or-Nothing Batch Rollback

- **Chose:** Streaming row-by-row validation that inserts every valid row and returns an itemized failure report detailing exact row numbers and error messages for invalid rows.
- **Rejected:** Wrapping the entire CSV import in a single database transaction that rolls back the entire file if a single row has an error.
- **Why:** Requirement 7 explicitly requires: *"Each import returns a per-row report naming exactly which rows failed and why, while still importing every row that was valid rather than rejecting the whole file over one bad line."* In real warehouse operations, an import file might contain 500 valid receipts and 2 typos; forcing operators to fix the typos and re-upload the entire batch creates operational delays.

---

## Decision 6: Secure HttpOnly Cookies vs. LocalStorage Bearer Tokens

- **Chose:** Signed `httpOnly` cookies with `SameSite=Lax` and custom anti-CSRF headers.
- **Rejected:** Storing JWT tokens in the browser's `localStorage` and attaching via `Authorization: Bearer` headers.
- **Why:** While `localStorage` is easier to set up across decoupled origins, it exposes authentication credentials directly to JavaScript. If any client-side script or third-party dependency is compromised (XSS), the token can be instantly stolen. `httpOnly` cookies completely isolate session credentials from JavaScript access.
- **Later reversed:** We initially started with `localStorage` token storage for rapid prototyping. We reversed this decision and refactored the entire authentication flow to `httpOnly` cookies with `cookie-parser`, pairing it with custom `X-Requested-With` header validation and origin checks to maintain ironclad defense against both XSS and CSRF.

---

## Decision 7: IPv4 Supabase Connection Pooling & Error Information Sanitization (CWE-209)

- **Chose:** Connecting through Supabase's IPv4-compatible Connection Pooler (`aws-0-ap-southeast-1.pooler.supabase.com:5432`) and enforcing strict server-side error sanitization for all 5xx / Prisma exceptions.
- **Rejected:** Direct database connection strings (`db.[ref].supabase.co`) and unmasked forwarding of `err.message` in the global Express error handler.
- **Why:** 
  1. **IPv4 Cloud Compatibility:** Modern Supabase direct endpoints resolve exclusively to IPv6 addresses. Free-tier cloud runtimes like Render operate on IPv4-only networks and cannot route to IPv6 hosts. Routing traffic through the Supabase connection pooler provides reliable dual-stack IPv4/IPv6 reachability.
  2. **Security & Information Disclosure (CWE-209):** Forwarding raw ORM and driver exceptions (`Invalid prisma.user.findUnique() invocation...`, hostnames, ports) directly into API response bodies creates a severe security vulnerability that leaks internal infrastructure topology and ORM structures to attackers, while confusing users. The global error handler now masks internal 500/DB errors into clean user messages while logging full diagnostic traces to server logs.

---

## Decision 8: Immutable Audit Timeline with Append-Only Diff Ledger (Requirement 9)

- **Chose:** An append-only event entity `audit_timeline_events` recording discrete event types (`CREATED`, `FIELD_CHANGE`, `NOTE`), actor ID, and exact prior and new values (`fieldName`, `oldValue`, `newValue`).
- **Rejected:** Storing a mutable change log or relying on generic `updatedAt` table columns.
- **Why:** Requirement 9 explicitly dictates an immutable, chronological timeline for every item that records every modification over time. Mutable audit records violate compliance and accounting integrity. Our structure captures granular field-level diffs automatically on every item update transaction, while providing warehouse staff with an append-only notes stream without giving staff permissions to modify item attributes.

---

## Decision 9: Transactional Non-Negative Stock Guarantees & Reason Mandatory Validation (Requirements 3 & 4)

- **Chose:** Executing all inventory-depleting movements (`ISSUE`, `TRANSFER`, and downward `ADJUSTMENT`) inside a serializable Prisma `$transaction` that dynamically re-computes the source location's on-hand balance immediately prior to creating the immutable ledger row, coupled with strict server-side validation rejecting any adjustment lacking a non-empty `reason`.
- **Rejected:** Client-side only stock checks or non-transactional pre-validation.
- **Why:** In multi-user warehouse environments, concurrent dispatch or transfer requests can easily create race conditions: if Location A has 20 units and two operators simultaneously issue 15 units, non-transactional checks would allow both to proceed, leaving stock at -10 units (a critical domain violation). Wrapping the derivation and insertion within an atomic database transaction guarantees serialized isolation, preventing any race condition from driving on-hand stock below zero. Requiring a mandatory reason for adjustments on the server prevents un-auditable phantom write-offs.
