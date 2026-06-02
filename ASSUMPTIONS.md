# Assumptions

Design assumptions taken as given during development.
An assumption is something **treated as true to make progress, which may later prove false** — distinct from a deliberate decision (those live in `docs/adr/`).

Each cycle that introduces new assumptions appends them here.

---

### A-001

- **Cycle:** cycle-001
- **Assumption:** The OpenAlex source entity ID (e.g. `S137773608`) is stable and can be used as a long-lived filter key in user settings.
- **Rationale:** OpenAlex IDs are assigned at ingestion and documented as stable persistent identifiers.
- **Status:** holding
- **Notes:** If OpenAlex ever merges or retires a source entity, stored venue IDs would silently stop matching. A future health-check on settings load could warn users.

### A-002

- **Cycle:** cycle-001
- **Assumption:** Users are willing to re-enter venue preferences after this upgrade; existing `filterVenues` strings (old format) are dropped.
- **Rationale:** Migrating free-text names to IDs would require a bulk lookup against the OpenAlex API at migration time, with uncertain match quality. Clean break is safer.
- **Status:** holding
- **Notes:** Revisit if user feedback indicates the migration friction is unacceptable.

### A-003

- **Cycle:** cycle-001
- **Assumption:** `npm install` segfaulting on this machine is a local environment issue, not a project dependency problem.
- **Rationale:** All network-touching package managers (npm, yarn, pnpm) crash with SIGSEGV; Deno (which bundles its own runtime) works fine.
- **Status:** holding
- **Notes:** Resolved by declaring deps in `package.json` manually and using Deno as a test runner fallback. Vitest will replace Deno once npm is stable.
