/**
 * Helper to bold the target vocabulary word in a sentence.
 * Handles both pre-existing <b> markup and programmatic bolding.
 */
export function boldVocabInSentence(sentence, vocabWord) {
  if (!sentence || !vocabWord) return sentence || '';
  
  // Check if sentence already has <b> tags - preserve them
  if (sentence.includes('<b>') || sentence.includes('<B>')) {
    return sentence;
  }
  
  // Programmatically bold the first occurrence of vocabWord
  const index = sentence.indexOf(vocabWord);
  if (index === -1) {
    // No match found - return original
    return sentence;
  }
  
  const before = sentence.substring(0, index);
  const match = sentence.substring(index, index + vocabWord.length);
  const after = sentence.substring(index + vocabWord.length);
  
  return `${before}<b>${match}</b>${after}`;
}

/**
 * Renders HTML string safely with only <b> tags allowed.
 * Returns JSX with text nodes and <strong> elements.
 */
export function renderWithBold(htmlString) {
  if (!htmlString) return null;
  
  // Split by <b> and </b> tags (case insensitive)
  const parts = htmlString.split(/(<b>|<\/b>|<B>|<\/B>)/gi);
  let isBold = false;
  const elements = [];
  
  parts.forEach((part, i) => {
    if (part.toLowerCase() === '<b>') {
      isBold = true;
    } else if (part.toLowerCase() === '</b>') {
      isBold = false;
    } else if (part) {
      elements.push(
        isBold ? <strong key={i}>{part}</strong> : <span key={i}>{part}</span>
      );
    }
  });
  
  return <>{elements}</>;
}