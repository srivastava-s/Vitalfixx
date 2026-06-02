## 2026-06-01 - Unnecessary Recalculations in Interactive Components
**Learning:** Found that `Sparkline.tsx` re-computes its SVG paths on *every single mouse move* during hover interactions due to local state updates. Similarly, `CodeBlock.tsx` re-runs a regex-based syntax highlighter on render, which gets triggered again when clicking 'Copy' due to state changes. These unmemoized calculations run unnecessarily when state independent of the data changes.
**Action:** Always use `useMemo` for mathematical array transformations (like charting coordinates) and heavy string manipulations (like regex highlighting) when a component contains interaction state (like hover/click) that triggers frequent re-renders.
## 2025-03-02 - Hoist Date allocation out of array loops

**Learning:** Allocating a new `Date` object (`new Date()`) inside a loop over an array of historical scans introduces redundant object allocation and method calls, causing unnecessary GC pressure and CPU cycles. Moving date calculations that resolve to the "current time" outside the loop significantly improves performance for large arrays.

**Action:** Whenever a loop requires the current time, always capture `Date.now()` or `new Date()` once before the loop and reuse that constant inside the loop.
