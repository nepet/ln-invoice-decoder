# Single-file, zero-network artifact

The tool's value depends on users believing their Invoice never leaves the
browser, so the build inlines all JavaScript and CSS into one `index.html`,
loads nothing from a third party, and carries a `connect-src 'none'` CSP meta
tag. A user can read the entire tool in View Source, or save the file and run it
from disk with no network at all — a claim they can check in ten seconds,
instead of a sentence in a README they have to trust.

## Consequences

- No code splitting or lazy loading, ever. Every dependency is paid for on first
  paint, which is the budget that keeps the dependency list short.
- Inline scripts need a build-time hash in the CSP, because GitHub Pages cannot
  set response headers.
- No analytics, error reporting, fonts, or node-graph lookups can be added
  without breaking the premise — node alias lookup was rejected on these grounds.
