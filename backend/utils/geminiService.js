import { GoogleGenAI } from "@google/genai";
import GeminiKeyManager from "../config/geminiKeys.js";

class GeminiService {
  constructor() {
    this.maxRetries = GeminiKeyManager.getTotalKeys();
    this.currentClient = null;
    this.isConfigured = false;
    this.currentModelName = null;

    this.availableModels = [
      "gemini-3-flash-preview",
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

  validateAndInitialize() {
    if (!GeminiKeyManager.hasValidKeys()) {
      throw new Error("Gemini API keys not configured");
    }
    this.initializeClient();
  }

  initializeClient() {
    const apiKey = GeminiKeyManager.getCurrentKey();

    if (GeminiKeyManager.isPlaceholderKey(apiKey)) {
      GeminiKeyManager.rotateKey();
      return this.initializeClient();
    }

    // ✅ SDK mới cần object
    this.currentClient = new GoogleGenAI({ apiKey });
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

        // Wrap the call with a timeout (180 seconds / 3 minutes)
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

          GeminiKeyManager.rotateKey();
          this.initializeClient();
          this.modelIndex = 0;

          retryCount++;
          if (retryCount < this.maxRetries) {
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

        // 503 Service unavailable (overload) → rotate key
        if (errorStatus === 503 || error.status === 503 || error.message?.includes("UNAVAILABLE")) {
          console.log("🔄 Model overloaded (503). Rotating API key...");

          GeminiKeyManager.rotateKey();
          this.initializeClient();
          this.modelIndex = 0;

          retryCount++;
          if (retryCount < this.maxRetries) {
            console.log(`   Retry ${retryCount}/${this.maxRetries}`);
            continue;
          } else {
            throw new Error("Model overloaded. All retries exhausted.");
          }
        }

        // API key invalid hoặc quota exceeded (429)
        if (
          error.message?.includes("API key") ||
          error.message?.includes("quota") ||
          errorStatus === 400 ||
          errorStatus === 429 ||
          error.status === 400 ||
          error.status === 429
        ) {
          console.log("🔄 API key issue (400/429). Rotating...");

          GeminiKeyManager.rotateKey();
          this.initializeClient();
          this.modelIndex = 0;

          retryCount++;
          if (retryCount < this.maxRetries) {
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