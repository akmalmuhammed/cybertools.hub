import { create } from 'zustand'

interface SearchStore {
    isOpen: boolean
    setIsOpen: (open: boolean) => void
    toggle: () => void
}

export const useSearchStore = create<SearchStore>((set) => ({
    isOpen: false,
    setIsOpen: (open) => set({ isOpen: open }),
    toggle: () => set((state) => ({ isOpen: !state.isOpen })),
}))
