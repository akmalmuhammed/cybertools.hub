import { LucideIcon } from "lucide-react"

export type ToolDomainId =
    | "soc"
    | "threat-intel"
    | "network"
    | "application"
    | "cloud-iam"
    | "supply-chain"
    | "data-privacy"

export type ToolProcessingMode = "local" | "network" | "hybrid"
export type ToolSensitivity = "low" | "medium" | "high"

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
