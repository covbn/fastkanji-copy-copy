/**
 * Vocabulary Normalization Utility
 * 
 * Single source of truth for converting raw vocabulary data into the app's card model.
 * Handles data cleaning, field mapping, and missing value defaults.
 */

/**
 * Strip HTML tags from a string
 * @param {string} str - String potentially containing HTML tags
 * @returns {string} Clean string without HTML
 */
function stripHtmlTags(str) {
  if (!str) return '';
  return str.replace(/<[^>]*>/g, '');
}

/**
 * Normalize a vocabulary row into a card object
 * @param {Object} vocabRow - Raw vocabulary data from database
 * @returns {Object} Normalized card object ready for use in the app
 */
export function normalizeVocabRowToCard(vocabRow) {
  if (!vocabRow) return null;

  // Clean all text fields of HTML tags
  const cleanText = (text) => stripHtmlTags(text || '');

  return {
    // Core identity
    id: vocabRow.id,
    vocab_index: vocabRow.vocab_index || null,
    core_index: vocabRow.core_index || null,

    // Primary card fields
    kanji: cleanText(vocabRow.kanji),
    hiragana: cleanText(vocabRow.hiragana),
    meaning: cleanText(vocabRow.meaning),
    
    // Metadata
    level: vocabRow.level || 'N5', // Default to N5 if missing
    part_of_speech: vocabRow.part_of_speech || '',

    // Audio and visual
    vocab_sound: vocabRow.vocab_sound || null,
    vocab_furigana: cleanText(vocabRow.vocab_furigana),

    // Example sentence
    example_sentence: cleanText(vocabRow.example_sentence),
    example_sentence_kana: cleanText(vocabRow.example_sentence_kana),
    example_sentence_meaning: cleanText(vocabRow.example_sentence_meaning),
    example_sentence_sound: vocabRow.example_sentence_sound || null,
    example_sentence_image: vocabRow.example_sentence_image || null,
    example_sentence_furigana: cleanText(vocabRow.example_sentence_furigana),
    
    // Testing
    sentence_cloze: cleanText(vocabRow.sentence_cloze),
  };
}

/**
 * Normalize an array of vocabulary rows
 * @param {Array} vocabRows - Array of raw vocabulary data
 * @returns {Array} Array of normalized card objects
 */
export function normalizeVocabArray(vocabRows) {
  if (!Array.isArray(vocabRows)) return [];
  return vocabRows
    .map(normalizeVocabRowToCard)
    .filter(card => card && card.kanji && card.hiragana); // Filter out invalid entries
}

/**
 * Get display-friendly level label
 * @param {string} level - Level code (N5, N4, N3, N2, N1, N0, etc.)
 * @returns {string} Display label
 */
export function getLevelLabel(level) {
  if (!level) return 'Unknown';
  
  // Map N0 and other non-standard levels to N5 for filtering
  const standardLevels = ['N5', 'N4', 'N3', 'N2', 'N1'];
  if (!standardLevels.includes(level.toUpperCase())) {
    return 'N5'; // Default non-standard levels to N5
  }
  
  return level.toUpperCase();
}