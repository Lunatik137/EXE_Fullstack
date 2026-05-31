// Gemini API Key Manager with automatic rotation
// Keys are loaded from environment variables: GEMINI_API_KEY_1, GEMINI_API_KEY_2, ...
const GEMINI_API_KEYS = Object.keys(process.env)
  .filter(key => /^GEMINI_API_KEY_\d+$/.test(key))
  .sort((a, b) => parseInt(a.split('_').pop()) - parseInt(b.split('_').pop()))
  .map(key => process.env[key])
  .filter(Boolean);

let currentKeyIndex = 0;

class GeminiKeyManager {
  static getCurrentKey() {
    return GEMINI_API_KEYS[currentKeyIndex];
  }

  static isPlaceholderKey(key) {
    return !key || key.startsWith('YOUR_GEMINI_API_KEY');
  }

  static hasValidKeys() {
    return GEMINI_API_KEYS.some(key => !this.isPlaceholderKey(key));
  }

  static getValidKeys() {
    return GEMINI_API_KEYS.filter(key => !this.isPlaceholderKey(key));
  }

  static rotateKey() {
    currentKeyIndex = (currentKeyIndex + 1) % GEMINI_API_KEYS.length;
    console.log(`🔄 Rotated to API key index: ${currentKeyIndex}`);
    return this.getCurrentKey();
  }

  static resetToFirstKey() {
    currentKeyIndex = 0;
    console.log('🔄 Reset to first API key');
  }

  static getTotalKeys() {
    return GEMINI_API_KEYS.length;
  }

  static getCurrentIndex() {
    return currentKeyIndex;
  }

  static getKeyByIndex(index) {
    return GEMINI_API_KEYS[index];
  }
}

export default GeminiKeyManager;
