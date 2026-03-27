import { match } from '../lib/fuzzyMatcher'

export function useVoiceCommand(commands) {
  const processCommand = (transcript) => {
    for (const [key, phrases] of Object.entries(commands)) {
      if (match(transcript, phrases)) {
        return key
      }
    }
    return null
  }
  return { processCommand }
}