import { create } from 'zustand'

export const useVoiceStore = create((set) => ({
  isListening: false,
  transcript: '',
  toggleListening: () => set((state) => ({ isListening: !state.isListening })),
  setTranscript: (text) => set({ transcript: text }),
}))