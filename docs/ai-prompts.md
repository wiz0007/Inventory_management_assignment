# AI prompts

The prompts used during the design and implementation of this system, in chronological order, grouped by technical milestone.

---

## Milestone 1: Stack Architecture & Technical Viability

### Prompt 1
> *"I want to analyze how we can implement this takehome assignment. I think we should use MERN stack, what do you think? Tell me which stack is more efficient and reliable for the 10 requirements."*

### What you got
The AI initially analyzed both MERN and relational options, highlighting that while MERN is common, MongoDB introduces severe reliability risks for an accounting-style append-only ledger requiring ACID transactions and derived quantity sorting. It strongly recommended PostgreSQL with Node.js and TypeScript.

### What you corrected
The AI initially recommended a full-stack Next.js monolith. However, having never built a project in Next.js, switching to an unfamiliar framework would violate the core instruction: *"Time spent learning something new to impress us is time not spent on the ten goals above... Submitting generated code you cannot explain is the single most common way candidates fail."* We corrected the AI to adopt a clean, decoupled **React (Vite) + Express.js (Node) + PostgreSQL** stack, which provides the relational reliability of PostgreSQL with the familiar React/Express ecosystem.

---

## Milestone 2: Schema Design & Indivisible Transfers

### Prompt 2
> *"Design the database schema for the 10 requirements, specifically ensuring the ledger is append-only and transfers are an indivisible operation."*

### What you got
The AI initially drafted a schema where an inter-location transfer was split into two correlated ledger rows: an `ISSUE` record from the source location and a `RECEIPT` record at the destination location, tied together by a `transferCorrelationId`.

### What you corrected (The Erroneous Output & Fix)
Splitting a transfer into two separate database records violates Requirement 4's rule that *"a transfer moves stock from one location to another as a single indivisible operation"*. If a system crash or unhandled error occurred between writing the outbound and inbound rows, one location's count would run permanently short and the other permanently long — the exact spreadsheet bug described in the assignment scenario! We instructed the AI to rewrite the `stock_movements` schema to represent transfers as **a single atomic row** carrying both `sourceLocationId` and `destinationLocationId`.

---

## Milestone 3: Agile Sprint Breakdown & Procedural Plan

### Prompt 3
> *"Let's do this through a disciplined software engineering approach. First define the sprint procedure and what work will go into each sprint before building."*

### What you got
A structured 7-sprint implementation plan mapping each of the 10 core requirements to user stories, technical deliverables, and explicit verification criteria, with documentation updated continuously alongside the codebase.

### What you corrected
Verified that all 10 core requirements had dedicated acceptance tests, ensuring that edge cases (such as alert re-arming when stock rises and falls again, and per-row CSV error reports) were explicitly tested rather than assumed.
