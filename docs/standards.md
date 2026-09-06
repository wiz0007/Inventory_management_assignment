# Standards & Guidelines

This document specifies the architectural, responsiveness, and release workflow standards followed in this project.

For details, refer to the rule definition at [`.agents/rules/frontend-responsiveness-and-workflow.md`](file:///c:/Users/AyushMaaN/Downloads/takehome-02-inventory-stock-control/takehome-02-inventory-stock-control/.agents/rules/frontend-responsiveness-and-workflow.md).

### 1. Viewport Responsiveness
- All interfaces, modals, and drawers must adapt gracefully down to 320px viewport width (split-screen / DevTools layout).
- Zero horizontal scroll policy.
- Dynamic text flex children must use `min-width: 0` and allow wrapping.
- Card headers with actor badges and long user names must use two-row hierarchy to prevent badge clipping.

### 2. Workflow & PR Protocol
- Automated commits/pushes are forbidden without user verification.
- Pull Requests are strictly created by the user.

### 3. Audit Logging
- Immutable append-only logs for all operational state changes and notes.

### 4. Component-Wise UI/UX Edge Cases
- **Modals & Dialogs:**
  - Clicking anywhere on the backdrop overlay outside the dialog closes the modal.
  - Event bubbling is stopped on the dialog panel (`e.stopPropagation()`).
  - Pressing the <kbd>Esc</kbd> key dismisses the modal immediately.
  - Background scrolling is locked (`overflow = 'hidden'`) while any modal is open and restored on close.
  - Modals have `max-height: 90vh; overflow-y: auto;` to prevent off-screen overflow on mobile.
- **Dropdowns & Popovers:**
  - Clicking outside closes open menus automatically.
  - Pressing <kbd>Esc</kbd> closes open menus.
  - Selecting an action auto-closes the popover.
- **Drawers & Mobile Menus:**
  - Close on backdrop tap, <kbd>Esc</kbd>, and navigation link selection.
- **Forms & Buttons:**
  - Double-submit prevention (`disabled={submitting}` + loading indicators).
  - Sanitized whitespace (`trim()`) and uppercase SKU handling.
  - Inline error notifications within modal panels.

