export function match(transcript, phrases) {
  if (!transcript) return false;

  const normalizedTranscript = transcript.toLowerCase().trim();

  return phrases.some(phrase => {
    const normalizedPhrase = phrase.toLowerCase().trim();

    // Exact match
    if (normalizedTranscript === normalizedPhrase) return true;

    // Contains match
    if (normalizedTranscript.includes(normalizedPhrase)) return true;

    // Fuzzy logic: if phrase is multiple words, check if most words are present
    const phraseWords = normalizedPhrase.split(' ');
    if (phraseWords.length > 1) {
      const matchedWords = phraseWords.filter(word => normalizedTranscript.includes(word));
      return (matchedWords.length / phraseWords.length) >= 0.75; // 75% match
    }

    return false;
  });
}
