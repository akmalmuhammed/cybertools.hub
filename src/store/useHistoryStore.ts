import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface HistoryItem {
    toolId: string
    timestamp: number
    lastInput?: string // Optional: remember last input? Maybe privacy issue. Let's keep it simple: visited tools.
}

interface HistoryStore {
    history: HistoryItem[]
    addToHistory: (toolId: string) => void
    clearHistory: () => void
}

export const useHistoryStore = create<HistoryStore>()(
    persist(
        (set) => ({
            history: [],
            addToHistory: (toolId) => set((state) => {
                // Remove if exists to push to top
                const filtered = state.history.filter(h => h.toolId !== toolId)
                return {
                    history: [{ toolId, timestamp: Date.now() }, ...filtered].slice(0, 10) // Keep last 10
                }
            }),
            clearHistory: () => set({ history: [] }),
        }),
        {
            name: 'history-storage',
        }
    )
)
