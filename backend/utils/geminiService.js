import { GoogleGenAI } from "@google/genai";
import GeminiKeyManager from "../config/geminiKeys.js";

class GeminiService {
  constructor() {
    this.currentClient = null;
    this.isConfigured = false;
    this.currentModelName = null;
    // Set of indices confirmed exhausted/invalid in this session
    this.exhaustedKeyIndices = new Set();

    this.availableModels = [
      "gemini-3.1-flash-lite",
    ];

    this.modelIndex = 0;

    try {
      this.validateAndInitialize();
      this.isConfigured = true;
    } catch (error) {
      console.warn("⚠ Gemini API not configured. Fallback mode enabled.");
      this.isConfigured = false;
    }
  }

  get maxRetries() {
    return GeminiKeyManager.getTotalKeys();
  }

  validateAndInitialize() {
    if (!GeminiKeyManager.hasValidKeys()) {
      throw new Error("Gemini API keys not configured");
    }
    this.initializeClient();
  }

  initializeClient() {
    const total = GeminiKeyManager.getTotalKeys();
    let attempts = 0;
    // Skip placeholder keys using a loop (no recursion)
    while (GeminiKeyManager.isPlaceholderKey(GeminiKeyManager.getCurrentKey())) {
      GeminiKeyManager.rotateKey();
      attempts++;
      if (attempts >= total) {
        throw new Error("No valid (non-placeholder) Gemini API keys found");
      }
    }
    const apiKey = GeminiKeyManager.getCurrentKey();
    this.currentClient = new GoogleGenAI({ apiKey });
  }

  rotateToNextAvailableKey() {
    const total = GeminiKeyManager.getTotalKeys();
    const startIndex = GeminiKeyManager.getCurrentIndex();
    // Mark current key as exhausted
    this.exhaustedKeyIndices.add(startIndex);

    // Find next non-exhausted key
    for (let i = 1; i <= total; i++) {
      const nextIndex = (startIndex + i) % total;
      if (!this.exhaustedKeyIndices.has(nextIndex) &&
          !GeminiKeyManager.isPlaceholderKey(GeminiKeyManager.getKeyByIndex(nextIndex))) {
        // Rotate until we reach nextIndex
        while (GeminiKeyManager.getCurrentIndex() !== nextIndex) {
          GeminiKeyManager.rotateKey();
        }
        console.log(`🔄 Rotated to non-exhausted key index: ${nextIndex}`);
        this.initializeClient();
        return true;
      }
    }
    return false; // all keys exhausted
  }

  async generateMealPlan(prompt) {
    if (!this.isConfigured) {
      throw new Error("Gemini API not configured");
    }

    let retryCount = 0;

    while (retryCount < this.maxRetries) {
      try {
        const modelName = this.availableModels[this.modelIndex];

        console.log(
          `🚀 Calling Gemini | Model: ${modelName} | Key index: ${GeminiKeyManager.getCurrentIndex()}`
        );

        // Wrap the call with a timeout (180 seconds)
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Gemini API timeout after 180 seconds")), 180000)
        );

        const result = await Promise.race([
          this.currentClient.models.generateContent({
            model: modelName,
            contents: prompt,
            generationConfig: {
              temperature: 0.6,
              topP: 0.9,
            }
          }),
          timeoutPromise
        ]);

        const text = result.text;

        if (!text || typeof text !== 'string') {
          console.error('⚠ Gemini returned empty/non-string text:', JSON.stringify(result).slice(0, 300));
          throw new Error(`Gemini returned empty response (finishReason may indicate blocked content)`);
        }

        console.log(`✅ Success with model: ${modelName}`);

        this.currentModelName = modelName;
        return text;
      } catch (error) {
        console.error("❌ Gemini error caught:", {
          message: error.message,
          status: error.status,
          errorCode: error.error?.code,
          errorStatus: error.error?.status
        });

        // Get error status from multiple possible locations
        const errorStatus = error.status || error.error?.code;

        // Timeout or fetch errors → rotate key and retry
        if (error.message?.includes("timeout") || error.message?.includes("fetch failed") || error.code === "UND_ERR_HEADERS_TIMEOUT") {
          console.log("⏱ Request timeout or network error. Rotating API key...");

          const hasNext = this.rotateToNextAvailableKey();
          this.modelIndex = 0;

          retryCount++;
          if (hasNext && retryCount < this.maxRetries) {
            console.log(`   Retry ${retryCount}/${this.maxRetries}`);
            continue;
          } else {
            throw new Error("Gemini API timeout after all retries. Please try again later.");
          }
        }

        // 404 model not found → thử model khác
        if (errorStatus === 404 || error.status === 404) {
          console.log("🔁 Model not found (404). Trying next model...");
          this.modelIndex++;

          if (this.modelIndex >= this.availableModels.length) {
            throw new Error(
              "No compatible Gemini model found. Check API permissions."
            );
          }

          continue;
        }

        // 503 Service unavailable (overload) → thử model khác trước, rồi mới rotate key
        if (errorStatus === 503 || error.status === 503 || error.message?.includes("UNAVAILABLE")) {
          // Thử model fallback tiếp theo trước
          if (this.modelIndex + 1 < this.availableModels.length) {
            this.modelIndex++;
            console.log(`🔄 Model overloaded (503). Switching to fallback model: ${this.availableModels[this.modelIndex]}`);
            retryCount++;
            continue;
          }

          // Đã hết model fallback → rotate key và reset về model đầu
          console.log("🔄 All models overloaded (503). Rotating API key...");
          const hasNext = this.rotateToNextAvailableKey();
          this.modelIndex = 0;

          retryCount++;
          if (hasNext && retryCount < this.maxRetries) {
            console.log(`   Retry ${retryCount}/${this.maxRetries}`);
            continue;
          } else {
            throw new Error("Model overloaded. All retries exhausted.");
          }
        }

        // API key invalid, quota exceeded (429), or suspended/forbidden (403)
        if (
          error.message?.includes("API key") ||
          error.message?.includes("quota") ||
          error.message?.includes("PERMISSION_DENIED") ||
          error.message?.includes("suspended") ||
          errorStatus === 400 ||
          errorStatus === 403 ||
          errorStatus === 429 ||
          error.status === 400 ||
          error.status === 403 ||
          error.status === 429
        ) {
          console.log(`🔄 API key issue (${errorStatus || error.status}). Rotating...`);

          const hasNext = this.rotateToNextAvailableKey();
          this.modelIndex = 0;

          retryCount++;
          if (hasNext && retryCount < this.maxRetries) {
            console.log(`   Retry ${retryCount}/${this.maxRetries}`);
            continue;
          } else {
            throw new Error("API quota exceeded. All keys exhausted.");
          }
        }

        // Throw any other error
        console.error("❌ Unhandled Gemini error:", error);
        throw error;
      }
    }

    throw new Error("All API keys exhausted. Please try again later.");
  }

  async generateContent(prompt) {
    return this.generateMealPlan(prompt);
  }
}

const geminiService = new GeminiService();
export default geminiService;