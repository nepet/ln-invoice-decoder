# Invoice Decoder

A browser tool that takes a BOLT11 invoice and shows a developer everything it
encodes — with particular attention to route hints, and to invoices that are
subtly wrong.

## Language

### The invoice

**Invoice**:
A BOLT11 string requesting a Lightning payment. Signed by the payee.
_Avoid_: payment request, bolt11, paystring, LN invoice

**Human-Readable Part**:
The prefix of an Invoice, before the separator. Carries the Network and,
optionally, the Amount.
_Avoid_: HRP (in prose), header, prefix

**Network**:
Which chain the Invoice is payable on — mainnet, testnet, signet, regtest.
_Avoid_: chain, currency, coin

**Amount**:
What the payee asks for, canonically in millisatoshi. An Invoice may carry no
Amount, in which case the payer chooses.
_Avoid_: value, price, sum, sats (as a field name)

**Tagged Field**:
One typed, length-prefixed entry in the Invoice's data part. Each has a
single-letter type, e.g. `p` for payment hash, `r` for a Route Hint.
_Avoid_: tag, attribute, field (unqualified), TLV

**Payee**:
The node that issued and signed the Invoice, and that receives the payment. Its
public key is usually absent from the Invoice and recovered from the signature.
_Avoid_: destination, recipient, node, receiver

### Route hints

**Route Hint**:
One `r` Tagged Field: an ordered list of Hops describing a path a payer can take
toward the Payee, when the final channels are unannounced. An Invoice may carry
several, each an independent alternative.
_Avoid_: routing hint, hint set, private route, r-field

**Hop**:
One entry within a Route Hint: the public key of the node where the hop
*begins*, plus the channel leading onward from it, plus that channel's routing
terms. The Payee never appears as a Hop — it is implied one step past the last
one.
_Avoid_: hop hint, hint hop, node, edge

**Short Channel ID**:
A Hop's channel, identified by the block, transaction index, and output index of
its funding output.
_Avoid_: SCID (in prose), channel id, chan id

**Hop Terms**:
The three routing parameters a Hop charges: base fee, proportional fee, and
CLTV delta.
_Avoid_: fees, policy, channel policy

**Hint Cost**:
The total fee and total CLTV delta a whole Route Hint adds to a payment. Derived
by the tool, not encoded in the Invoice, and defined only when the Invoice
carries an Amount — the tool shows no number the Invoice does not determine.
_Avoid_: total fee, routing fee, cost

### What the tool says back

**Diagnostic**:
Something the tool has to say about a specific part of an Invoice, at one of
three severities.
_Avoid_: error, message, issue, validation result

**Error**:
A Diagnostic meaning decoding could not continue past this point.

**Warning**:
A Diagnostic meaning the Invoice decoded, but violates the spec or is
self-inconsistent — a real implementation will likely misbehave on it.

**Info**:
A Diagnostic meaning something legal but worth noticing.

**Spec Diagnostic**:
A Diagnostic derived from a written rule in the specification, and citing it.

**Practice Diagnostic**:
A Diagnostic derived from how implementations actually behave, and naming them.
Always legal per the specification — that is what distinguishes it.
_Avoid_: compatibility warning, wallet warning, heuristic

## Example dialogue

> **Dev**: The wallet says "no route" but the invoice looks fine to me.
>
> **Domain expert**: Has it got a Route Hint?
>
> **Dev**: One, with a single Hop.
>
> **Domain expert**: Then that Hop's public key is the LSP, not the Payee — the
> Payee is implied one step further on. Does the Short Channel ID look real?
>
> **Dev**: `0x0x0`.
>
> **Domain expert**: There's your Warning. The Payee signed a Route Hint that
> points at a channel that doesn't exist yet, so no payer can build the last leg.
>
> **Dev**: And the Hint Cost?
>
> **Domain expert**: Irrelevant if the channel isn't there — but worth reading
> anyway, because a Hop that charges more than the payer's fee limit fails the
> same way, and the wallet reports it with the same useless message.
