import { LucideIcon } from "lucide-react"

export interface Tool {
    id: string
    name: string
    description: string
    path: string
    icon: LucideIcon
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
