# Schema

## Table by Table: Columns and Types

### 1. `users`
Represents application users across managers and warehouse staff.
- `id`: `UUID` (Primary Key, default `gen_random_uuid()`)
- `email`: `VARCHAR(255)` (Unique, Not Null)
- `passwordHash`: `VARCHAR(255)` (Not Null, bcrypt hash)
- `name`: `VARCHAR(255)` (Not Null)
- `role`: `ENUM('MANAGER', 'STAFF')` (Default `'STAFF'`)
- `createdAt`: `TIMESTAMP WITH TIME ZONE` (Default `NOW()`)
- `updatedAt`: `TIMESTAMP WITH TIME ZONE`

### 2. `locations`
Physical or logical warehouse sites, stock rooms, and retail floors.
- `id`: `UUID` (Primary Key)
- `name`: `VARCHAR(255)` (Unique, Not Null)
- `code`: `VARCHAR(50)` (Unique, Not Null, e.g. "WH-MAIN", "STORE-01")
- `isActive`: `BOOLEAN` (Default `true`)
- `createdAt`: `TIMESTAMP WITH TIME ZONE` (Default `NOW()`)

### 3. `user_locations`
Join table establishing many-to-many staff-to-location assignments.
- `userId`: `UUID` (Foreign Key $\rightarrow$ `users.id`, On Delete Cascade)
- `locationId`: `UUID` (Foreign Key $\rightarrow$ `locations.id`, On Delete Cascade)
- `assignedAt`: `TIMESTAMP WITH TIME ZONE` (Default `NOW()`)
- *Composite Primary Key:* `(userId, locationId)`

### 4. `categories`
Managed classification hierarchy for inventory items.
- `id`: `UUID` (Primary Key)
- `name`: `VARCHAR(100)` (Unique, Not Null)
- `createdAt`: `TIMESTAMP WITH TIME ZONE` (Default `NOW()`)

### 5. `items`
Catalog of trackable inventory products.
- `id`: `UUID` (Primary Key)
- `sku`: `VARCHAR(100)` (Unique, Not Null)
- `name`: `VARCHAR(255)` (Not Null)
- `description`: `TEXT` (Nullable)
- `uom`: `VARCHAR(50)` (Not Null, Default `'units'`)
- `reorderLevel`: `INTEGER` (Not Null, Default `10`, Check `reorderLevel >= 0`)
- `categoryId`: `UUID` (Foreign Key $\rightarrow$ `categories.id`, Not Null)
- `isArchived`: `BOOLEAN` (Default `false`)
- `createdAt`: `TIMESTAMP WITH TIME ZONE` (Default `NOW()`)
- `updatedAt`: `TIMESTAMP WITH TIME ZONE`

### 6. `stock_movements` (The Append-Only Ledger)
The single source of truth for all inventory quantities.
- `id`: `UUID` (Primary Key)
- `itemId`: `UUID` (Foreign Key $\rightarrow$ `items.id`, Not Null)
- `type`: `ENUM('RECEIPT', 'ISSUE', 'TRANSFER', 'ADJUSTMENT')` (Not Null)
- `quantity`: `INTEGER` (Not Null, Check `quantity > 0` for Receipts, Issues, Transfers; signed for Adjustments)
- `sourceLocationId`: `UUID` (Foreign Key $\rightarrow$ `locations.id`, Nullable — used for `ISSUE`, `TRANSFER`)
- `destinationLocationId`: `UUID` (Foreign Key $\rightarrow$ `locations.id`, Nullable — used for `RECEIPT`, `TRANSFER`)
- `reason`: `TEXT` (Nullable — strictly enforced for `ADJUSTMENT`)
- `userId`: `UUID` (Foreign Key $\rightarrow$ `users.id`, Not Null)
- `createdAt`: `TIMESTAMP WITH TIME ZONE` (Default `NOW()`)

### 7. `item_timeline`
Immutable historical log of all item metadata updates and staff notes.
- `id`: `UUID` (Primary Key)
- `itemId`: `UUID` (Foreign Key $\rightarrow$ `items.id`, Not Null)
- `userId`: `UUID` (Foreign Key $\rightarrow$ `users.id`, Not Null)
- `eventType`: `ENUM('CREATED', 'FIELD_CHANGE', 'NOTE')` (Not Null)
- `fieldName`: `VARCHAR(100)` (Nullable)
- `oldValue`: `TEXT` (Nullable)
- `newValue`: `TEXT` (Nullable)
- `noteText`: `TEXT` (Nullable)
- `createdAt`: `TIMESTAMP WITH TIME ZONE` (Default `NOW()`)

### 8. `low_stock_dismissals`
Tracks manager dismissals of low-stock alerts to enable intelligent re-arming.
- `id`: `UUID` (Primary Key)
- `itemId`: `UUID` (Foreign Key $\rightarrow$ `items.id`, Not Null)
- `dismissedBy`: `UUID` (Foreign Key $\rightarrow$ `users.id`, Not Null)
- `quantityAtDismissal`: `INTEGER` (Not Null)
- `dismissedAt`: `TIMESTAMP WITH TIME ZONE` (Default `NOW()`)

---

## Relationships: One-to-Many vs. Many-to-Many

1. **Many-to-Many:**
   - `users` $\leftrightarrow$ `locations` (via `user_locations` join table): A staff member can be responsible for multiple locations, and each location can have multiple assigned staff.
2. **One-to-Many:**
   - `categories` $\rightarrow$ `items`: Each item belongs to exactly one category; a category has many items.
   - `items` $\rightarrow$ `stock_movements`: Each movement belongs to exactly one item.
   - `items` $\rightarrow$ `item_timeline`: Each item maintains an ordered list of timeline events.
   - `users` $\rightarrow$ `stock_movements`: An audit trail linking every recorded movement to the user who entered it.
   - `locations` $\rightarrow$ `stock_movements`: Linked both as source and destination.

---

## Constraints: Database vs. Application Enforcement

### Database-Enforced Constraints:
1. **Uniqueness:** `users.email`, `locations.code`, `locations.name`, `categories.name`, `items.sku`.
2. **Referential Integrity:** Foreign keys on all relational columns (`itemId`, `userId`, `categoryId`, etc.) with `RESTRICT` on catalog references to prevent orphaned movements.
3. **Immutability (Append-Only):** Database rules / triggers blocking `UPDATE` and `DELETE` queries on `stock_movements` and `item_timeline`.
4. **Non-Nullability:** Required fields (`name`, `sku`, `quantity`, `type`) cannot be inserted as `NULL`.

### Application-Enforced Constraints:
1. **Transfer Stock Availability (Negative Stock Prevention):**
   - The database cannot easily compute aggregate stock across prior rows in a simple column `CHECK` constraint without recursive triggers. Instead, the application runs an ACID transaction with a row lock (`SELECT ... FOR UPDATE`), sums the ledger for the source location, and aborts before inserting if balance $< \text{transferQty}$.
2. **Role and Location Access Boundaries:**
   - Checked at the application middleware layer: verifying that only managers can archive or assign staff, and that staff can only record transactions for locations present in their JWT/session assignment set.
3. **Mandatory Reason on Adjustments:**
   - Enforced by application validation (Zod schema) on `POST /api/movements`: if `type === 'ADJUSTMENT'`, `reason` must be a non-empty string.
4. **Alert Re-Arming Lifecycle:**
   - Evaluated by comparing the timeline of ledger movements against the `dismissedAt` timestamp.

---

## Deliberate Denormalisation

We maintained a strictly normalized relational core with one deliberate architectural choice:
- **No Stored `on_hand_quantity` Column:** To honor Requirement 4, on-hand balances are **never denormalised** onto the `items` or `locations` tables. Every count is dynamically derived from the sum of the ledger entries.
- **Unified Movement Table for Transfers:** Instead of splitting a transfer into two separate movements (an outbound issue and an inbound receipt), a transfer is stored as **one single atomic row** carrying both `sourceLocationId` and `destinationLocationId`. This guarantees indivisibility at the schema level: it is physically impossible for the outbound leg of a transfer to exist without the inbound leg.

---

## What Would Break First at 100x the Data?

If transaction volume multiplied by 100x (millions of ledger rows):
1. **On-the-fly Ledger Aggregation on the Items List:**
   - Calculating `SUM(quantity)` across millions of rows for every page load of the item catalog would cause query latency spikes.
   - *Fix:* Introduce **Materialized Views** refreshed on commit, or a daily closing balance snapshot table (e.g. `stock_daily_balances`) where on-hand stock equals $\text{Latest Snapshot} + \sum(\text{Movements since snapshot})$.
2. **Server-Side Sort by On-Hand Stock:**
   - Sorting items by a derived aggregate without an index on the computed sum requires scanning the movements table.
   - *Fix:* Create indexed summary tables partitioned by date or location.
3. **CSV Export of Complete Stock Position:**
   - Exporting millions of rows in a single HTTP request would exhaust Node.js memory.
   - *Fix:* Implement cursor-based database streaming (`pg-query-stream`) piped directly to the HTTP response stream.
