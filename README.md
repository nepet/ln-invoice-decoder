# ln-invoice-decoder

A browser tool that decodes a BOLT11 Lightning invoice and shows a developer
everything it encodes — with particular attention to Route Hints, and to
invoices that are subtly wrong.

**Live: <https://nepet.github.io/ln-invoice-decoder/>**

## What this is

Off-the-shelf BOLT11 decoders are written for payers: they throw on the first
problem and give up. This tool is written for the developer staring at a
wallet that says "no route" or "invalid invoice" with no further explanation.
Paste the invoice, or scan its QR code, and every Tagged Field is decoded and
laid out, alongside the Diagnostics the tool has to say about it — including
the fields that decoded fine but are still wrong.

It is not a payer. It never asks you for anything a wallet would need to
actually pay — no channel state, no balance, no signing key. It reads what the
Payee put in the invoice and explains it.

## The claim: your invoice never leaves the browser

Decoding happens entirely client-side. Nothing about the invoice you paste,
scan, or share is ever sent anywhere.

This is not a promise you have to take on trust — it is checkable:

- **Read the source.** The whole tool ships as a single `index.html` file,
  every script and stylesheet inlined. There is nothing to fetch and nothing
  hidden behind a bundler you'd need to reverse — View Source shows you
  everything that runs.
- **Enforced, not just asserted.** That `index.html` carries a
  `Content-Security-Policy` with `connect-src 'none'` and `default-src 'none'`,
  built from a hash of the page's own inline script and style — so if the page
  tried to make a network request, or if anyone injected script the browser
  didn't already hash, the browser refuses it, not just the tool's own code.
  `scripts/verify-artifact.mjs` checks this CSP is present, checks nothing in
  the build references an external `src`, `href`, or CSS `url()`, and runs in
  CI on every build — a build that would ship a network-capable artifact fails
  before it deploys.
- **Try it yourself.** Save the page (`File → Save Page As…`, or `curl` the
  live URL), turn off your network connection, and open the saved file. Paste
  an invoice. It still works — because it was never talking to anything.

If you share a link, the invoice travels in the URL fragment
(`#lnbc1...`), not the query string or path — see
[ADR-0003](docs/adr/0003-invoice-in-url-fragment-only.md) for why that
distinction matters: browsers never send the fragment to a server, but they do
send the path and query string, and GitHub Pages would log it.

See [ADR-0002](docs/adr/0002-single-file-zero-network-artifact.md) for the
single-file, zero-network design this all rests on, and
[`CONTEXT.md`](CONTEXT.md) for the domain language used throughout the tool
and this README.

## Route Hints

A Route Hint (BOLT11's `r` Tagged Field) is an ordered list of Hops describing
a path toward the Payee for the invoice's final, unannounced channels. An
invoice can carry several, each an independent alternative — and each Hop's
public key is where that hop *begins*, never the Payee itself, which is
implied one step past the last Hop.

For each Route Hint, the tool shows every Hop's node, its Short Channel ID,
and its Hop Terms (base fee, proportional fee, CLTV delta), plus the Hint
Cost: the total fee and total CLTV delta the whole hint adds to a payment.
Hint Cost is derived by the tool, not read from the invoice — it is computed
**backwards from the Payee**, because a Hop's proportional fee applies to
everything it forwards, which includes the fees every Hop after it already
added. Walking hop-by-hop from the front would get the fee wrong.

Hint Cost is only ever shown when it means something: an invoice with no
Amount lets the payer choose how much to pay, so there is nothing to compute
a fee against, and the Hint Cost section is **hidden entirely** rather than
showing an estimate the invoice doesn't actually determine.

## Diagnostics

Everything the tool has to say about an invoice — a decoding failure, a spec
violation, or something merely worth noticing — is a Diagnostic, at one of
three severities (Error, Warning, Info). Diagnostics that come from a specific
source say so, and the tool distinguishes two of them:

- **Spec Diagnostics** cite a rule: a specific clause of the BOLT11
  specification the invoice violates or that the tool is applying.
- **Practice Diagnostics** name implementations: something the invoice is
  fully legal per BOLT11, but that real wallets (LND, CLN, LDK, …) are named
  as actually rejecting or mishandling. These exist because "legal" and "will
  pay" are different questions, and the gap between them is exactly what
  sends a developer down a debugging rabbit hole.

(A third class of Info-level Diagnostics — an invoice expired, or carries no
expiry so the default applies — is just the tool's own observation, with no
rule or implementation to cite.)

Decoding never throws. Every stage — bech32, the 5-bit word stream, the
tagged-field walk — returns whatever it managed to read plus the Diagnostics
about it, so a broken invoice still shows everything the tool could recover,
with the specific point of failure marked rather than a stack trace.

## Development

```bash
npm ci
npm run dev        # local dev server
npm test           # vitest
npm run typecheck  # tsc --noEmit
npm run build      # vite build → dist/index.html, CSP injected and verified
```

`npm run build` produces exactly one file, `dist/index.html`
(~190 KB), and then runs `scripts/verify-artifact.mjs` against it — the same
check `.github/workflows/deploy.yml` runs in CI before anything is deployed,
so a red test or a network-capable build never reaches the live site.

## Further reading

- [`CONTEXT.md`](CONTEXT.md) — the domain language: Invoice, Payee, Route
  Hint, Hop, Hint Cost, Tagged Field, Diagnostic, and how they relate.
- [ADR-0001](docs/adr/0001-hand-written-tolerant-decoder.md) — why the decoder
  is hand-written rather than built on an existing library.
- [ADR-0002](docs/adr/0002-single-file-zero-network-artifact.md) — the
  single-file, zero-network artifact.
- [ADR-0003](docs/adr/0003-invoice-in-url-fragment-only.md) — why the invoice
  lives in the URL fragment and never the query string.

## License

MIT — see [LICENSE](LICENSE).
