import { create } from 'zustand'

export const useXPStore = create((set) => ({
  xp: 0,
  streak: 0,
  addXP: (points) => set((state) => ({ xp: state.xp + points })),
  setStreak: (days) => set({ streak: days }),
}))