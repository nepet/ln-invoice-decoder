# The Invoice goes in the URL fragment, never the query string

Sharing a pre-loaded link is a real workflow — pasting one into a bug report —
so the Invoice is written to the URL fragment via `history.replaceState`. It
must never move to the query string or path: browsers do not transmit the
fragment, but they do send the path and query to GitHub's servers, where it
lands in their access logs. That single change would turn a client-side tool
into one that quietly discloses every invoice it decodes.

## Consequences

- `replaceState`, not `pushState` — the back button should leave the tool, not
  step through every invoice pasted into it.
- The Invoice is visible in the address bar and travels with any shared link.
  That is the accepted cost of shareability, not an oversight.
