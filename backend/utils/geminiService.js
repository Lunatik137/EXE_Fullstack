import { GoogleGenerativeAI } from '@google/generative-ai';
import GeminiKeyManager from '../config/geminiKeys.js';

class GeminiService {
  constructor() {
    this.maxRetries = GeminiKeyManager.getTotalKeys();
    this.currentClient = null;
    this.isConfigured = false;
    this.currentModelName = null; 
    this.availableModels = [
      'gemini-2.5-flash'
    ];
    this.modelIndex = 0;
    
    try {
      this.validateAndInitialize();
      this.isConfigured = true;
    } catch (error) {
      console.warn(' Gemini API not configured. Fallback mode will be used.');
      this.isConfigured = false;
    }
  }

  validateAndInitialize() {
    if (!GeminiKeyManager.hasValidKeys()) {
      console.error(' App will continue with FALLBACK MODE (random meal selection)\n');
      throw new Error('Gemini API keys not configured');
    }
    this.initializeClient();
  }

  initializeClient() {
    const apiKey = GeminiKeyManager.getCurrentKey();
    if (GeminiKeyManager.isPlaceholderKey(apiKey)) {
      // Skip to next valid key
      GeminiKeyManager.rotateKey();
      return this.initializeClient();
    }
    this.currentClient = new GoogleGenerativeAI(apiKey);
  }

  async generateMealPlan(prompt, retryCount = 0, modelRetry = false) {
    if (!this.isConfigured) {
      throw new Error('Gemini API keys not configured. Please add your API keys to backend/config/geminiKeys.js');
    }

    if (retryCount >= this.maxRetries) {
      throw new Error('All API keys exhausted. Please try again later.');
    }

    // Reset model index at the start of a new generation attempt (not a retry)
    if (retryCount === 0 && !modelRetry) {
      // If we have a known working model, try it first
      if (this.currentModelName && this.availableModels.includes(this.currentModelName)) {
        const workingIndex = this.availableModels.indexOf(this.currentModelName);
        if (workingIndex !== -1) {
          this.modelIndex = workingIndex;
          console.log(`💡 Using last known working model: ${this.currentModelName}`);
        } else {
          this.modelIndex = 0;
        }
      } else {
        this.modelIndex = 0;
      }
    }

    // Ensure modelIndex is within bounds
    if (this.modelIndex >= this.availableModels.length) {
      this.modelIndex = 0;
    }

    try {
      // Use current model from the list
      const modelName = this.availableModels[this.modelIndex];
      
      if (!modelName) {
        throw new Error('No model name available. Model list may be empty.');
      }
      
      const model = this.currentClient.getGenerativeModel({ model: modelName });
      
      console.log(`Attempting Gemini API call with model: ${modelName}, key index: ${GeminiKeyManager.getCurrentIndex()}`);
      
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      console.log(` Gemini API call successful with model: ${modelName}`);
      this.currentModelName = modelName; // Remember working model
      return text;

    } catch (error) {
      console.error(` Gemini API error: ${error.message}`);

      // Check if it's a "must provide model name" error (configuration issue)
      if (error.message.includes('Must provide a model name')) {
        console.error(' Configuration error: No valid model name available');
        console.error(`   Model index: ${this.modelIndex}, Available models: ${this.availableModels.length}`);
        throw new Error('Gemini configuration error. Model list may be corrupted.');
      }

      // Check if it's a model not found error (404)
      if (error.status === 404 && error.message.includes('not found')) {
        const currentModel = this.availableModels[this.modelIndex];
        console.log(` Model "${currentModel}" not available, trying next model...`);
        console.log(`   Tested models so far: ${this.availableModels.slice(0, this.modelIndex + 1).join(', ')}`);
        
        // Try next model in the list
        this.modelIndex++;
        if (this.modelIndex < this.availableModels.length) {
          const nextModel = this.availableModels[this.modelIndex];
          console.log(`   Next attempt: ${nextModel} (${this.modelIndex + 1}/${this.availableModels.length})`);
          return this.generateMealPlan(prompt, retryCount, true);
        } else {
          // All models exhausted
          throw new Error('No compatible Gemini model found. Please check your API key permissions.');
        }
      }

      // Check if it's an invalid API key error
      if (
        error.message.includes('API key not valid') ||
        error.message.includes('API_KEY_INVALID') ||
        error.status === 400
      ) {
        console.log(` Invalid API key at index ${GeminiKeyManager.getCurrentIndex()}, rotating...`);
        
        // Reset model index for new key
        this.modelIndex = 0;
        
        // Rotate to next key
        GeminiKeyManager.rotateKey();
        this.initializeClient();
        
        // Retry with new key
        return this.generateMealPlan(prompt, retryCount + 1);
      }

      // Check if it's a quota error
      if (
        error.message.includes('quota') || 
        error.message.includes('RESOURCE_EXHAUSTED') ||
        error.message.includes('429') ||
        error.message.includes('rate limit')
      ) {
        console.log(` Quota exceeded on key ${GeminiKeyManager.getCurrentIndex()}, rotating...`);
        
        // Reset model index for new key
        this.modelIndex = 0;
        
        // Rotate to next key
        GeminiKeyManager.rotateKey();
        this.initializeClient();
        
        // Retry with new key
        return this.generateMealPlan(prompt, retryCount + 1);
      }

      // If it's not a recognized error, throw it
      throw error;
    }
  }

  async generateContent(prompt) {
    return this.generateMealPlan(prompt);
  }
}

// Export singleton instance
const geminiService = new GeminiService();
export default geminiService;
