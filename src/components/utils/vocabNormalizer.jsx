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
    
    // Metadata (map dataset level to UI level for display)
    level: datasetLevelToUiLevel(vocabRow.level || 'N4'),
    datasetLevel: vocabRow.level || 'N4', // Keep original for debugging
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
 * LEVEL MAPPING UTILITIES
 * Dataset uses N4, N3, N2, N1, N0
 * UI displays N5, N4, N3, N2, N1 (no N0 shown)
 */

/**
 * Map UI level to dataset level for querying
 * @param {string} uiLevel - Level shown in UI (N5, N4, N3, N2, N1)
 * @returns {string} Dataset level (N4, N3, N2, N1, N0)
 */
export function uiLevelToDatasetLevel(uiLevel) {
  const mapping = {
    'N5': 'N4',
    'N4': 'N3',
    'N3': 'N2',
    'N2': 'N1',
    'N1': 'N0'
  };
  const mapped = mapping[uiLevel?.toUpperCase()] || 'N4';
  console.log('[LevelMap] UI→Dataset:', uiLevel, '→', mapped);
  return mapped;
}

/**
 * Map dataset level to UI level for display
 * @param {string} datasetLevel - Level from dataset (N4, N3, N2, N1, N0)
 * @returns {string} UI display level (N5, N4, N3, N2, N1)
 */
export function datasetLevelToUiLevel(datasetLevel) {
  const mapping = {
    'N4': 'N5',
    'N3': 'N4',
    'N2': 'N3',
    'N1': 'N2',
    'N0': 'N1'
  };
  return mapping[datasetLevel?.toUpperCase()] || 'N5';
}

/**
 * Get all UI levels for display in dropdowns
 * @returns {Array<string>} UI levels [N5, N4, N3, N2, N1]
 */
export function getUiLevels() {
  return ['N5', 'N4', 'N3', 'N2', 'N1'];
}