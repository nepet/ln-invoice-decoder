export type Severity = 'error' | 'warning' | 'info'

export type DiagnosticSource =
  | { kind: 'spec'; rule: string }
  | { kind: 'practice'; implementations: string[] }
  | { kind: 'tool' }

export interface Anchor {
  field?: string
  hintIndex?: number
  hopIndex?: number
}

export interface Diagnostic extends Anchor {
  severity: Severity
  message: string
  source: DiagnosticSource
}

/** Every decode step returns what it managed to read, plus what it has to say. */
export interface Decoded<T> {
  value: T
  diagnostics: Diagnostic[]
}

/** Character offsets into the original invoice string. */
export interface Span {
  start: number
  end: number
}

export type Network = 'mainnet' | 'testnet' | 'signet' | 'regtest' | 'simnet'

export interface Hrp {
  raw: string
  network: Network | null
  amountMsat: bigint | null
}

export interface RawField {
  tag: string
  type: number
  dataLength: number
  words: Uint8Array
  span: Span
}

export interface ShortChannelId {
  block: number
  tx: number
  output: number
  /** Decimal string of the 64-bit value. */
  raw: string
}

export interface Hop {
  nodeId: string
  scid: ShortChannelId
  feeBaseMsat: number
  feeProportionalMillionths: number
  cltvExpiryDelta: number
}

export interface HintCost {
  feeMsat: bigint
  cltvDelta: number
}

export interface RouteHint {
  hops: Hop[]
  /** Null when the invoice carries no Amount — never estimated. */
  cost: HintCost | null
}

export interface Feature {
  bit: number
  name: string | null
  required: boolean
}

export interface DecodedField {
  tag: string
  name: string
  display: string
  raw: RawField
}

export interface DecodedInvoice {
  input: string
  hrp: Hrp
  timestamp: number | null
  fields: DecodedField[]
  payeeNodeId: string | null
  signatureValid: boolean
  paymentHash: string | null
  paymentSecret: string | null
  description: string | null
  descriptionHash: string | null
  expirySeconds: number
  minFinalCltvExpiryDelta: number
  fallbackAddress: string | null
  features: Feature[]
  routeHints: RouteHint[]
  diagnostics: Diagnostic[]
}
