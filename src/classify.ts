export type InputKind =
  | 'bolt11' | 'bolt12-offer' | 'bolt12-invoice' | 'lnurl'
  | 'node-uri' | 'bitcoin-address' | 'empty' | 'unknown'

export function normaliseInput(raw: string): string {
  return raw.trim().replace(/^lightning:/i, '').trim().toLowerCase()
}

export function classify(raw: string): { kind: InputKind; message?: string } {
  const s = normaliseInput(raw)
  if (s === '') return { kind: 'empty' }
  if (/^ln(bc|tbs|tb|bcrt|sb)\d*[munp]?1/.test(s)) return { kind: 'bolt11' }
  if (s.startsWith('lno1')) return { kind: 'bolt12-offer', message: 'That is a BOLT12 offer. This tool decodes BOLT11 invoices.' }
  if (s.startsWith('lni1')) return { kind: 'bolt12-invoice', message: 'That is a BOLT12 invoice. This tool decodes BOLT11 invoices.' }
  if (s.startsWith('lnurl1')) return { kind: 'lnurl', message: 'That is an LNURL. This tool decodes BOLT11 invoices.' }
  if (/^0[23][0-9a-f]{64}@/.test(s)) return { kind: 'node-uri', message: 'That is a node URI, not an invoice.' }
  if (/^(bc1|tb1|bcrt1|[13])[a-z0-9]{10,}$/.test(s)) return { kind: 'bitcoin-address', message: 'That is an on-chain bitcoin address, not a Lightning invoice.' }
  return { kind: 'unknown' }
}
