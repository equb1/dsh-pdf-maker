/** Host/Gateway availability projection shared with the browser client. */

/** Bundled Gateway process status. */
export interface GatewayStatus {
  readonly state: 'stopped' | 'starting' | 'running' | 'failed'
  readonly origin: string | null
  readonly message: string | null
}

/** Result of an explicit Gateway start. */
export interface EnsureGatewayResult {
  readonly origin: string
  readonly alreadyRunning: boolean
}

/** Package-level capability projection returned by `GET /pdf-api/status`. */
export interface PdfPackageStatus {
  readonly version: string
  readonly gateway: GatewayStatus
  readonly engines: {
    readonly edit: boolean
    readonly render: boolean
  }
}
