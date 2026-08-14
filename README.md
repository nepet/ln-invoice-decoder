# ln-invoice-decoder

A browser tool that decodes a BOLT11 Lightning invoice and shows a developer
everything it encodes — with particular attention to Route Hints, and to
invoices that are subtly wrong.

**Live (once deployed):** <https://nepet.github.io/ln-invoice-decoder/> — not
yet published; see [Deploying](#deploying).

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

Decoding happens entirely client-side. No request carries any part of the
invoice you paste or scan, because the page makes no requests at all — once it
has loaded, it never talks to anything again.

This is not a promise you have to take on trust — it is checkable:

- **Read the source.** The whole tool ships as a single `index.html` file,
  every script and stylesheet inlined, and it is **not minified**: View Source
  shows you the same function names, control flow and layout as `src/`, for
  the tool and for its three dependencies alike. The bundler concatenates and
  strips comments — for those, read `src/` — but it mangles nothing, so
  nothing is hiding behind a one-letter identifier. That costs about 170 KB
  over a minified build, which is the cheaper thing to spend here.
- **Grep it yourself.** The artifact contains no network primitive at all, not
  even an unreachable one inside a dependency:

  ```bash
  grep -nE 'fetch\(|XMLHttpRequest|WebSocket|sendBeacon|EventSource|importScripts' index.html
  ```

  finds nothing, on the very file you are running. `test/artifact.test.ts`
  asserts the same thing on every build.
- **Enforced, not just asserted.** That `index.html` carries a
  `Content-Security-Policy` built from a hash of the page's own inline script
  and style, so the browser refuses any script it did not already hash — the
  enforcement does not depend on the tool's own code behaving. `connect-src
  'none'` blocks fetch, XHR, WebSocket and beacons outright, and
  `default-src 'none'` means no subresource of any kind loads. What is
  permitted is deliberately narrow and local: `img-src 'self' data: blob:` and
  `media-src 'self' blob:`, which is what the QR scanner needs to read a camera
  frame or a screenshot you dropped on the page.
  `scripts/verify-artifact.mjs` fails the build if that CSP is missing or
  weakened, if anything in the page references an external `src`, `href`, or
  CSS `url()`, or if any of the network primitives above appears anywhere in
  it. It is wired into `npm run build` and into
  [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) as the last
  step before a deploy, so a build that acquired one of them fails there
  rather than reaching the site.
- **Try it yourself.** Save the page (`File → Save Page As…` once it's
  live, or run `npm run build` locally and open `dist/index.html` directly),
  turn off your network connection, and open the saved file. Paste an
  invoice. It still works — because it was never talking to anything.

What the CSP does not do is make the tool trustworthy on someone else's
server: it is enforced by *your* browser against *the file you loaded*, so it
is only worth as much as the file you checked. Save it, read it, and run it
from disk if it matters to you.

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

For each Route Hint, the tool shows every Hop's public key, its Short Channel ID,
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

## The signature, and what it proves

An Invoice usually carries no key for its Payee, so the Payee is *recovered*
from the signature rather than checked against anything. Recovery succeeds for
essentially any well-formed 64-byte signature: it yields *a* key, not a
verdict. Tamper with one word of an invoice and re-checksum it, and this tool —
like every other BOLT11 decoder — reports a perfectly good signature belonging
to a **different Payee**.

So the tool never says "signature valid". It says `Signature well-formed;
payee recovered`, and on any invoice without an `n` Tagged Field it adds an
Info Diagnostic saying exactly this, because the useful check is comparing the
recovered Payee against the one you were expecting. When an invoice *does*
carry `n` and it disagrees with the recovered key, that is a Warning.

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

`npm run build` produces exactly one file, `dist/index.html` (~355 KB —
unminified on purpose, see [the claim](#the-claim-your-invoice-never-leaves-the-browser)),
and then runs `scripts/verify-artifact.mjs` against it — the same
check [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) is
configured to run in CI, after `typecheck` and `test`, before every deploy,
so a red test or a network-capable build is designed to never reach the live
site.

## Deploying

This repository is not yet published. `.github/workflows/deploy.yml` is
committed and ready — it runs `typecheck`, `test`, and `build` before
deploying — but it has not run yet, because the repository has no GitHub
remote. To publish it, the owner runs:

```bash
gh repo create nepet/ln-invoice-decoder --public --source=. --remote=origin --push
gh api -X POST repos/nepet/ln-invoice-decoder/pages -f build_type=workflow
```

That creates the repository, pushes this history, and switches Pages to
build from the Actions workflow rather than a branch. The first push triggers
the workflow; once it succeeds, the site above is live.

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
