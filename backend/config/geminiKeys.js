// Gemini API Key Manager with automatic rotation
// IMPORTANT: Replace these with your real Google Gemini API keys
// Get keys from: https://ai.google.dev/
const GEMINI_API_KEYS = [
  "AIzaSyDdEu7qM--wUCn3OJBQGqT5VkS178OMfyQ",
  "AIzaSyDjg_qLoP4IE90JUu6thhs6CopjjyQb2No",
  "AIzaSyC8AoyNRfHGk7k26nN64Uh0QEZIuaxOCN0",
  "AIzaSyAHDCs9ixhG2yGJkg-FL1LiO6RlAygz340",
  "AIzaSyBgO3XMik6kGQJLEkKvuP4pOHnD3soXcfY",
  "AIzaSyBbheLRqgRgZvXVxiaxxqhid1SfZf6ZHrk",
  "AIzaSyB2oN1DIpP5Vl-Sv3fR0xKKAJg1AqjOkMA",
  "AIzaSyAA9Ca396l96kBtHrRREXwpJmAgBTodyEY",
  "AIzaSyAtaTdYkqQj5LZJL8kAsKMmGehGXY-9-Hw",
  "AIzaSyAjvM7lTTim0L69qeNsU4-y9K6tkxzFP-A",
  "AIzaSyD6Pj2eUjHJruIRVLCLA83CgxSrInL7af0",
  "AIzaSyBU4FHh1yC023jBJ736kcoygJ6OpksVQOQ",
  "AIzaSyDytzxJKl0k6k24oNouekqd4iuD4HBWSAg",
  "AIzaSyBYhwfeqMKUhGi3YmKmezjUXmX26IGaQ2E"
];

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
}

export default GeminiKeyManager;
