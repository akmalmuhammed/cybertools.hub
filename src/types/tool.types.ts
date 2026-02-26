import { LucideIcon } from "lucide-react"

export type ToolDomainId =
    | "soc"
    | "threat-intel"
    | "network"
    | "application"
    | "cloud-iam"
    | "supply-chain"
    | "osint"
    | "pentest"
    | "ai-llm"
    | "data-privacy"

export type ToolProcessingMode = "local" | "network" | "hybrid"
export type ToolSensitivity = "low" | "medium" | "high"
export type ToolOutboundPolicy = "none" | "optional" | "required"
export type ToolPageMode = "analyst" | "simple"
export type ToolInputMode = "text" | "json" | "csv" | "file" | "batch"
export type ToolOutputKind = "json" | "table" | "diff" | "timeline" | "policy" | "manifest"
export type ToolDefaultPanel = "findings" | "evidence" | "export" | "history"
export type ToolFindingSeverity = "critical" | "high" | "medium" | "low" | "info"

export interface ToolCapability {
    inputModes: ToolInputMode[]
    outputKinds: ToolOutputKind[]
    supportsExport: boolean
    supportsBatch: boolean
    supportsLocalOnly: boolean
}

export interface ToolFinding {
    id: string
    severity: ToolFindingSeverity
    confidence: number
    category: string
    title: string
    description: string
    evidenceRef?: string
    remediation?: string
}

export interface ToolResultSummary {
    status: "ok" | "warning" | "error"
    score: number | null
    title: string
    text: string
    metrics?: Record<string, number>
}

export interface ToolResultExport {
    label: string
    kind: "json" | "csv" | "markdown" | "text"
    payload: string
}

export interface ToolResultEnvelope<TEvidence = Record<string, unknown>> {
    summary: ToolResultSummary
    findings: ToolFinding[]
    evidence: TEvidence[]
    recommendations: string[]
    exports: ToolResultExport[]
    raw?: unknown
}

export interface Tool {
    id: string
    name: string
    description: string
    path: string
    icon: LucideIcon
    domainId: ToolDomainId
    processingMode: ToolProcessingMode
    sensitivity: ToolSensitivity
    evidenceTags: string[]
    category: ToolCategory
    status: 'ready' | 'beta' | 'planned' | 'new'
    keywords: string[]
    capability?: ToolCapability
    outboundPolicy?: ToolOutboundPolicy
    requiresExplicitAction?: boolean
    pageMode?: ToolPageMode
    defaultPanels?: ToolDefaultPanel[]
}

export type ToolCategory =
    | 'security'
    | 'network'
    | 'application'
    | 'others'

export interface CategoryInfo {
    id: ToolCategory
    label: string
    description: string
}
