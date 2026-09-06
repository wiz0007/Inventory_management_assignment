# Engineering Standards, Responsiveness & Workflow Guidelines

This rule document is permanently recorded for all development tasks in this repository. The agent MUST review and strictly adhere to these standards before writing any code, modifying UI components, or performing Git operations.

---

## 1. 📱 Frontend Responsiveness Mandate (The "Split-Screen / DevTools" Rule)

Every UI surface must render cleanly on **all viewport sizes**, specifically down to **320px – 380px** (typical when a developer or reviewer has DevTools open occupying half the display):

1. **Flexbox Overflow Prevention:**
   - **Rule:** Never use `display: flex; gap: ...` without `min-width: 0` on flex items and `flex-wrap: wrap` when child elements contain dynamic text (user names, role titles, timestamps, badges).
   - Flex children default to `min-width: auto`, which prevents them from shrinking and forces the container to blow out past the viewport edge. Always add `min-width: 0` and allow wrapping.

2. **Hierarchical Card & Modal Headers:**
   - When displaying an audit badge (e.g. `[FIELD_CHANGE]`), user name (which may contain full names and titles like `"Elena Rostova (Inventory Manager)"`), and role badge (`[MANAGER]`):
     - **Do NOT** place them on a single un-wrapping row.
     - **Do:** Structure into two logical rows:
       - **Row 1:** Event Badge + Role Badge on the left; Timestamp on the right.
       - **Row 2:** Full user name with `word-break: break-word` and `min-width: 0`.
     - This guarantees role badges (`[MANAGER]`, `[STAFF]`) never clip or overflow out of cards on narrow viewports.

3. **Adaptive Modal & Drawer Padding:**
   - Do NOT use hardcoded large padding like `padding: 1.75rem` (28px each side = 56px lost) on modals.
   - On screens $\le$ 640px, use `padding: 1rem 0.75rem`.
   - Prevent modal body horizontal overflow: add `overflow-x: hidden; width: 100%; box-sizing: border-box`.

4. **Zero Horizontal Page Scroll:**
   - Enforce `html, body { overflow-x: hidden; max-width: 100vw; }`.
   - Any layout causing a horizontal scrollbar on mobile or split-screen is a critical defect.

5. **Category & Taxonomy Filters:**
   - When categories or filters exceed 3–4 items, avoid sprawling rows of pill chips that wrap into 4+ messy rows.
   - Use the **Dropdown Box Pattern**: `Category` label on the left with icon, and a styled dropdown selector on the right containing "All Categories (N)" and all individual options.

6. **Navigation Bar Mobile Hygiene & Redundancy Removal:**
   - On mobile/tablet screens ($\le$ 1180px), HIDE the desktop role-switcher dropdown and logout buttons from the top bar entirely (`nav-desktop-profile`, `nav-desktop-logout`). Never cram two competing menus (role dropdown + hamburger) side-by-side into a 320px–380px top bar.
   - The mobile drawer (`≡`) serves as the single source of truth on mobile: displaying the active user profile card, role badge, 1-tap demo role switcher, navigation links, and sign-out button.
   - On ultra-compact screens ($\le$ 380px), hide the brand title text (`nav-logo-title`), displaying only the square logo icon to guarantee the hamburger toggle has ample margin.

7. **Zero Internal Developer Artifacts in UI:**
   - NEVER render internal development tags, sprint numbers (e.g. `Sprint 2 (Req 2 & 9)`), requirement IDs, or backlog milestones in user-facing UI badges or descriptions. These belong exclusively in PRs, git commits, and technical documentation.

---

## 2. 🛑 Git & Release Protocol Mandate

1. **Verification Before Commit:**
   - **NEVER** automatically run `git commit` or `git push` until the user has personally reviewed and verified the changes in their browser / terminal.
   - The agent should only prepare changes locally, build/test them, and invite the user to verify.

2. **Pull Requests:**
   - **Pull Request creation is strictly out of bounds for the agent.**
   - Only the user creates PRs. The agent must NEVER run `gh pr create` or automated PR scripts.

---

## 3. 🛡️ Data Integrity & Audit Principles

1. **Immutable Audit Timelines:**
   - Audit records (`item_timeline`) are strictly append-only.
   - Never provide `PUT` or `DELETE` endpoints for timeline events.
   - Field updates must record atomic before-and-after diffs (`fieldName`, `oldValue`, `newValue`) in the same database transaction.

2. **Server-Side Enforcement:**
   - Always enforce RBAC and location boundaries on the backend in middleware; never rely on frontend button hiding alone.

---

## 4. 🔲 Component-Wise UI/UX Edge Cases Standards

Every interactive frontend component must anticipate and resolve its standard UI/UX edge cases:

### A. Modals & Dialogs
1. **Backdrop Click Dismissal:**
   - Clicking anywhere on the semi-transparent backdrop overlay outside the modal dialog MUST close the modal.
   - **Crucial Implementation:** Attach `onClick={closeModal}` to the backdrop overlay, and attach `onClick={(e) => e.stopPropagation()}` to the inner modal dialog panel to prevent clicks inside the modal from bubbling up and closing it.
2. **Keyboard <kbd>Esc</kbd> Key Dismissal:**
   - Pressing the <kbd>Escape</kbd> key MUST dismiss any open modal, drawer, or dialog immediately.
   - This prevents keyboard-navigating users or users experiencing layout locks from feeling trapped.
3. **Background Body Scroll Locking:**
   - While any modal is open, prevent background scrolling by setting `document.body.style.overflow = 'hidden'`.
   - When the modal is closed or unmounted, ALWAYS restore `document.body.style.overflow = 'unset'` in the cleanup function.
4. **Mobile Height & Inner Scrolling:**
   - Modals must have `max-height: 90vh; overflow-y: auto;` so they never stretch off-screen on short screens or when virtual keyboards pop up on mobile devices.
5. **State & Error Cleanup on Dismiss:**
   - Closing a modal without saving must reset any temporary error banners (`formError`, `catError`) so the next open starts with clean state.

### B. Dropdowns & Popover Menus
1. **Click Outside to Close:**
   - Clicking anywhere outside an active dropdown (e.g. role switcher, filter popover) MUST automatically close the dropdown via a `mousedown` / `touchstart` listener on `document`.
2. **Keyboard <kbd>Esc</kbd> Key Dismissal:**
   - Pressing <kbd>Escape</kbd> must immediately close open dropdown menus.
3. **Selection Auto-Close:**
   - Selecting an option in a menu should trigger the action and immediately close the menu.
4. **Boundary Clipping:**
   - Position popovers with `max-width: 90vw` and proper alignment (`right: 0` or `left: 0`) so they never force horizontal scrollbars.

### C. Slide-Over Drawers & Mobile Navigation
1. **Backdrop & <kbd>Esc</kbd> Dismissal:**
   - Mobile navigation drawers must close when the backdrop is clicked or <kbd>Esc</kbd> is pressed.
2. **Navigation Auto-Close:**
   - Clicking any navigation item or "Sign Out" inside a mobile drawer must automatically close the drawer (`setMobileMenuOpen(false)`).

### D. Forms & Mutation Buttons
1. **Double-Submit Prevention:**
   - Disable submit buttons (`disabled={submitting}`) and display loading text or spinner to prevent accidental duplicate entries.
2. **Whitespace Sanitization:**
   - Sanitize user strings with `.trim()` (and uppercase for SKUs) before transmission to avoid trailing whitespace errors.
3. **Validation Feedback:**
   - Provide inline error banners within modals rather than abrupt browser alerts.

### E. Data Lists & Empty States
1. **Empty States with Call-to-Action:**
   - If a catalog, list, or timeline is empty or filtered out, provide an informative empty state with an icon, explanation, and action button (e.g. "Create Item Now").
2. **Overflow & Long String Handling:**
   - Always use `min-width: 0` and `word-break: break-word` on dynamic titles, notes, and user names to prevent grid blowout.

