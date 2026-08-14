# Hand-written, tolerant BOLT11 decoder

Every off-the-shelf BOLT11 decoder (`bolt11`, `light-bolt11-decoder`, LDK's
`lightning-invoice` via WASM) is written for payers, so it throws on the first
problem and returns nothing. This tool exists to explain invoices that are
broken, so it decodes BOLT11 itself: bech32 → 5-bit stream → tagged-field walk,
with each stage returning whatever it managed to read plus Diagnostics, never an
exception. We accept owning the correctness risk, and pay for it with the BOLT11
specification's test vectors as tests.

## Consequences

- The BOLT11 test vectors are load-bearing, not a nicety.
- Spec rules of the form "a reader MUST skip X" are implemented as a Warning
  plus a decoded value, not as a skip — the whole point is to show the user what
  a real implementation will silently ignore.
