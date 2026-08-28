import z from '@deepseek-ai/schemastery'

/** Configuration shared by the PDF service provider and its consumers. */
export interface Config {
  /** Initial loopback port used by the bundled Gateway; occupied ports advance by one. */
  gatewayPort?: number
  /** Start the bundled Gateway when file state is first requested. */
  autoStartGateway?: boolean
  /** Maximum time allowed for the bundled Gateway to become healthy. */
  gatewayStartupTimeoutMs?: number
  /** HTTP timeout used for Gateway state reads. */
  gatewayRequestTimeoutMs?: number
  /** HTTP timeout used for Gateway mutations. */
  gatewayMutationTimeoutMs?: number
  /** Maximum lifetime of one PDF edit or export operation. */
  pdfOperationTimeoutMs?: number
  /** Maximum lifetime of one render/screenshot operation. */
  screenshotOperationTimeoutMs?: number
  /** Maximum number of pages rendered by one screenshot call. */
  screenshotMaxPages?: number
  /** Maximum pixel count for each rendered screenshot image. */
  screenshotMaxPixels?: number
  /** Freshness window for file state reads. */
  stateCacheTtlMs?: number
  /** Register model-facing `pdf_*` tools. */
  tools?: boolean
  /** Register bundled PDF skills. */
  skills?: boolean
}

/** Fully resolved configuration used by the implementation. */
export interface ResolvedConfig {
  readonly gatewayPort: number
  readonly autoStartGateway: boolean
  readonly gatewayStartupTimeoutMs: number
  readonly gatewayRequestTimeoutMs: number
  readonly gatewayMutationTimeoutMs: number
  readonly pdfOperationTimeoutMs: number
  readonly screenshotOperationTimeoutMs: number
  readonly screenshotMaxPages: number
  readonly screenshotMaxPixels: number
  readonly stateCacheTtlMs: number
  readonly tools: boolean
  readonly skills: boolean
}

/** Cordis configuration schema. */
export const Config: z<Config> = z.object({
  gatewayPort: z.natural().max(65535).default(9080),
  autoStartGateway: z.boolean().default(true),
  gatewayStartupTimeoutMs: z.natural().default(10_000),
  gatewayRequestTimeoutMs: z.natural().default(3_000),
  gatewayMutationTimeoutMs: z.natural().default(60_000),
  pdfOperationTimeoutMs: z.natural().default(120_000),
  screenshotOperationTimeoutMs: z.natural().default(120_000),
  screenshotMaxPages: z.natural().default(30),
  screenshotMaxPixels: z.natural().default(16_777_216),
  stateCacheTtlMs: z.natural().default(1_000),
  tools: z.boolean().default(true),
  skills: z.boolean().default(true),
})

/** Apply defaults and reject configuration that cannot run. */
export function resolveConfig(config: Config = {}): ResolvedConfig {
  const resolved: ResolvedConfig = {
    gatewayPort: config.gatewayPort ?? 9080,
    autoStartGateway: config.autoStartGateway ?? true,
    gatewayStartupTimeoutMs: config.gatewayStartupTimeoutMs ?? 10_000,
    gatewayRequestTimeoutMs: config.gatewayRequestTimeoutMs ?? 3_000,
    gatewayMutationTimeoutMs: config.gatewayMutationTimeoutMs ?? 60_000,
    pdfOperationTimeoutMs: config.pdfOperationTimeoutMs ?? 120_000,
    screenshotOperationTimeoutMs:
      config.screenshotOperationTimeoutMs ?? 120_000,
    screenshotMaxPages: config.screenshotMaxPages ?? 30,
    screenshotMaxPixels: config.screenshotMaxPixels ?? 16_777_216,
    stateCacheTtlMs: config.stateCacheTtlMs ?? 1_000,
    tools: config.tools ?? true,
    skills: config.skills ?? true,
  }
  if (
    !Number.isInteger(resolved.gatewayPort) ||
    resolved.gatewayPort < 1 ||
    resolved.gatewayPort > 65_535
  ) {
    throw new Error('pdf: gatewayPort must be an integer between 1 and 65535')
  }
  return resolved
}
