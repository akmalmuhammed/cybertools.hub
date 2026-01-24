import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface FavoritesStore {
    favorites: string[] // List of tool IDs
    addFavorite: (id: string) => void
    removeFavorite: (id: string) => void
    toggleFavorite: (id: string) => void
    isFavorite: (id: string) => boolean
}

export const useFavoritesStore = create<FavoritesStore>()(
    persist(
        (set, get) => ({
            favorites: [],
            addFavorite: (id) => set((state) => ({ favorites: [...state.favorites, id] })),
            removeFavorite: (id) => set((state) => ({ favorites: state.favorites.filter((fid) => fid !== id) })),
            toggleFavorite: (id) => {
                const { favorites } = get()
                if (favorites.includes(id)) {
                    set({ favorites: favorites.filter((fid) => fid !== id) })
                } else {
                    set({ favorites: [...favorites, id] })
                }
            },
            isFavorite: (id) => get().favorites.includes(id),
        }),
        {
            name: 'favorites-storage',
        }
    )
)
