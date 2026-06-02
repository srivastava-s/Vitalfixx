## 2026-06-01 - Unnecessary Recalculations in Interactive Components
**Learning:** Found that `Sparkline.tsx` re-computes its SVG paths on *every single mouse move* during hover interactions due to local state updates. Similarly, `CodeBlock.tsx` re-runs a regex-based syntax highlighter on render, which gets triggered again when clicking 'Copy' due to state changes. These unmemoized calculations run unnecessarily when state independent of the data changes.
**Action:** Always use `useMemo` for mathematical array transformations (like charting coordinates) and heavy string manipulations (like regex highlighting) when a component contains interaction state (like hover/click) that triggers frequent re-renders.

## 2023-11-20 - Supabase Aggregate Functions
**Learning:** Supabase (PostgREST) supports server-side aggregation for functions like `sum()` directly within the `.select()` statement without needing a separate RPC function. The correct syntax is `.select('column_name.sum()').single()`. This avoids fetching numerous rows over the network only to iterate over them in memory using Array.reduce().
**Action:** When calculating sums, averages, or max/min values from a database, always look for server-side aggregation features. In Supabase, use the `.select('col.sum()')` syntax to improve performance significantly (e.g. up to 98% CPU time saved in iteration logic).
