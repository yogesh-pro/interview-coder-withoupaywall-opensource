// ConfigHelper.ts
import fs from "node:fs"
import path from "node:path"
import { app } from "electron"
import { EventEmitter } from "events"
import { OpenAI } from "openai"

interface Config {
  // Separate API keys for each service
  openaiApiKey?: string;
  geminiApiKey?: string;
  openrouterApiKey?: string;
  openrouterModel?: string;
  
  // Legacy field for backward compatibility
  apiKey?: string;
  
  apiProvider: "openai" | "gemini" | "openrouter";  // Updated provider selection
  extractionModel: string;
  solutionModel: string;
  debuggingModel: string;
  mcqModel: string;
  language: string;
  opacity: number;
  solvingMode: "coding" | "mcq";  // New field for solving mode
}

export class ConfigHelper extends EventEmitter {
  private configPath: string;
  private defaultConfig: Config = {
    openaiApiKey: "",
    geminiApiKey: "",
    openrouterApiKey: "",
    openrouterModel: "meta-llama/llama-3.1-8b-instruct:free",
    apiKey: "", // Legacy field for backward compatibility
    apiProvider: "gemini", // Default to Gemini
    extractionModel: "gemini-2.5-flash", // Updated to use 2.5 Flash as default
    solutionModel: "gemini-2.5-flash",
    debuggingModel: "gemini-2.5-flash",
    mcqModel: "gemini-2.5-flash",
    language: "python",
    opacity: 1.0,
    solvingMode: "coding" // Default to coding mode
  };

  constructor() {
    super();
    // Use the app's user data directory to store the config
    try {
      this.configPath = path.join(app.getPath('userData'), 'config.json');
      console.log('Config path:', this.configPath);
    } catch (err) {
      console.warn('Could not access user data path, using fallback');
      this.configPath = path.join(process.cwd(), 'config.json');
    }
    
    // Ensure the initial config file exists
    this.ensureConfigExists();
  }

  /**
   * Ensure config file exists
   */
  private ensureConfigExists(): void {
    try {
      if (!fs.existsSync(this.configPath)) {
        this.saveConfig(this.defaultConfig);
      }
    } catch (err) {
      console.error("Error ensuring config exists:", err);
    }
  }

  /**
   * Validate and sanitize model selection to ensure only allowed models are used
   */
  private sanitizeModelSelection(model: string, provider: "openai" | "gemini" | "openrouter"): string {
    if (provider === "openai") {
      // Only allow gpt-4o and gpt-4o-mini for OpenAI
      const allowedModels = ['gpt-4o', 'gpt-4o-mini'];
      if (!allowedModels.includes(model)) {
        console.warn(`Invalid OpenAI model specified: ${model}. Using default model: gpt-4o`);
        return 'gpt-4o';
      }
      return model;
    } else if (provider === "gemini")  {
      // Allow all supported Gemini models including the new 2.5 models
      const allowedModels = [
        'gemini-2.5-pro', 
        'gemini-2.5-flash', 
        'gemini-2.5-flash-lite-preview-06-17',
        'gemini-2.0-flash'
      ];
      if (!allowedModels.includes(model)) {
        console.warn(`Invalid Gemini model specified: ${model}. Using default model: gemini-2.5-flash`);
        return 'gemini-2.5-flash'; // Updated default to 2.5 Flash
      }
      return model;
    } else if (provider === "openrouter") {
      // For OpenRouter, allow any model string as it's user-configurable
      return model || "meta-llama/llama-3.1-8b-instruct:free";
    }
    
    console.warn(`Unknown provider: ${provider}. Using default Gemini model.`);
    return 'gemini-2.5-flash';
  }

  public loadConfig(): Config {
    try {
      if (fs.existsSync(this.configPath)) {
        const configData = fs.readFileSync(this.configPath, 'utf8');
        const config = JSON.parse(configData);
        
        // Ensure apiProvider is a valid value, remove anthropic support
        if (config.apiProvider !== "openai" && config.apiProvider !== "gemini" && config.apiProvider !== "openrouter") {
          config.apiProvider = "gemini"; // Default to Gemini if invalid
        }
        
        // Convert anthropic to gemini for migration
        if (config.apiProvider === "anthropic") {
          config.apiProvider = "gemini";
        }
        
        // Sanitize model selections to ensure only allowed models are used
        let configChanged = false;
        if (config.extractionModel) {
          const originalModel = config.extractionModel;
          config.extractionModel = this.sanitizeModelSelection(config.extractionModel, config.apiProvider);
          if (originalModel !== config.extractionModel) configChanged = true;
        }
        if (config.solutionModel) {
          const originalModel = config.solutionModel;
          config.solutionModel = this.sanitizeModelSelection(config.solutionModel, config.apiProvider);
          if (originalModel !== config.solutionModel) configChanged = true;
        }
        if (config.debuggingModel) {
          const originalModel = config.debuggingModel;
          config.debuggingModel = this.sanitizeModelSelection(config.debuggingModel, config.apiProvider);
          if (originalModel !== config.debuggingModel) configChanged = true;
        }
        
        // Save the config if we had to sanitize any models
        if (configChanged) {
          console.log("Config was updated to fix invalid model selections");
          this.saveConfig(config);
        }
        
        return {
          ...this.defaultConfig,
          ...config
        };
      }
      
      // If no config exists, create a default one
      this.saveConfig(this.defaultConfig);
      return this.defaultConfig;
    } catch (err) {
      console.error("Error loading config:", err);
      return this.defaultConfig;
    }
  }

  /**
   * Save configuration to disk
   */
  public saveConfig(config: Config): void {
    try {
      // Ensure the directory exists
      const configDir = path.dirname(this.configPath);
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }
      // Write the config file
      fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2));
    } catch (err) {
      console.error("Error saving config:", err);
    }
  }

  /**
   * Update specific configuration values
   */
  public updateConfig(updates: Partial<Config>): Config {
    try {
      const currentConfig = this.loadConfig();
      let provider = updates.apiProvider || currentConfig.apiProvider;
      
      // Handle unique API keys for each service
      if (updates.openaiApiKey || updates.geminiApiKey || updates.openrouterApiKey) {
        // Direct API key updates for specific services
        if (updates.openaiApiKey && !updates.apiProvider) {
          provider = "openai";
          updates.apiProvider = provider;
        } else if (updates.geminiApiKey && !updates.apiProvider) {
          provider = "gemini";
          updates.apiProvider = provider;
        } else if (updates.openrouterApiKey && !updates.apiProvider) {
          provider = "openrouter";
          updates.apiProvider = provider;
        }
      }
      
      // Auto-detect provider based on legacy API key format if provided
      if (updates.apiKey && !updates.apiProvider) {
        if (updates.apiKey.trim().startsWith('sk-')) {
          provider = "openai";
          updates.openaiApiKey = updates.apiKey; // Migrate to specific key
          console.log("Auto-detected OpenAI API key format");
        } else {
          provider = "gemini";
          updates.geminiApiKey = updates.apiKey; // Migrate to specific key
          console.log("Using Gemini API key format (default)");
        }
        updates.apiProvider = provider;
      }
      
      // If provider is changing, reset models to the default for that provider
      if (updates.apiProvider && updates.apiProvider !== currentConfig.apiProvider) {
        if (updates.apiProvider === "openai") {
          updates.extractionModel = "gpt-4o";
          updates.solutionModel = "gpt-4o";
          updates.debuggingModel = "gpt-4o";
          updates.mcqModel = "gpt-4o";
        } else if (updates.apiProvider === "openrouter") {
          updates.extractionModel = updates.openrouterModel || "meta-llama/llama-3.1-8b-instruct:free";
          updates.solutionModel = updates.openrouterModel || "meta-llama/llama-3.1-8b-instruct:free";
          updates.debuggingModel = updates.openrouterModel || "meta-llama/llama-3.1-8b-instruct:free";
          updates.mcqModel = updates.openrouterModel || "meta-llama/llama-3.1-8b-instruct:free";
        } else {
          updates.extractionModel = "gemini-2.5-flash";
          updates.solutionModel = "gemini-2.5-flash";
          updates.debuggingModel = "gemini-2.5-flash";
          updates.mcqModel = "gemini-2.5-flash";
        }
      }
      
      // Sanitize model selections in the updates
      if (updates.extractionModel) {
        updates.extractionModel = this.sanitizeModelSelection(updates.extractionModel, provider);
      }
      if (updates.solutionModel) {
        updates.solutionModel = this.sanitizeModelSelection(updates.solutionModel, provider);
      }
      if (updates.debuggingModel) {
        updates.debuggingModel = this.sanitizeModelSelection(updates.debuggingModel, provider);
      }
      if (updates.mcqModel) {
        updates.mcqModel = this.sanitizeModelSelection(updates.mcqModel, provider);
      }
      
      const newConfig = { ...currentConfig, ...updates };
      this.saveConfig(newConfig);
      
      // Only emit update event for changes other than opacity
      // This prevents re-initializing the AI client when only opacity changes
      if (updates.openaiApiKey !== undefined || updates.geminiApiKey !== undefined || 
          updates.openrouterApiKey !== undefined || updates.apiProvider !== undefined || 
          updates.extractionModel !== undefined || updates.solutionModel !== undefined || 
          updates.debuggingModel !== undefined || updates.mcqModel !== undefined || 
          updates.language !== undefined) {
        this.emit('config-updated', newConfig);
      }
      
      return newConfig;
    } catch (error) {
      console.error('Error updating config:', error);
      return this.defaultConfig;
    }
  }

  /**
   * Check if the API key is configured for the current provider
   */
  public hasApiKey(): boolean {
    const config = this.loadConfig();
    
    if (config.apiProvider === "openai") {
      return !!(config.openaiApiKey && config.openaiApiKey.trim().length > 0);
    } else if (config.apiProvider === "gemini") {
      return !!(config.geminiApiKey && config.geminiApiKey.trim().length > 0);
    } else if (config.apiProvider === "openrouter") {
      return !!(config.openrouterApiKey && config.openrouterApiKey.trim().length > 0);
    }
    
    // Fallback to legacy API key
    return !!(config.apiKey && config.apiKey.trim().length > 0);
  }
  
  /**
   * Validate the API key format
   */
  public isValidApiKeyFormat(apiKey: string, provider?: "openai" | "gemini" | "openrouter" ): boolean {
    // If provider is not specified, attempt to auto-detect
    if (!provider) {
      if (apiKey.trim().startsWith('sk-')) {
        provider = "openai";
      } else {
        provider = "gemini";
      }
    }
    
    if (provider === "openai") {
      // Basic format validation for OpenAI API keys
      return /^sk-[a-zA-Z0-9]{32,}$/.test(apiKey.trim());
    } else if (provider === "gemini") {
      // Basic format validation for Gemini API keys (usually alphanumeric with no specific prefix)
      return apiKey.trim().length >= 10; // Assuming Gemini keys are at least 10 chars
    } else if (provider === "openrouter") {
      // Basic format validation for OpenRouter API keys
      return /^sk-or-[a-zA-Z0-9]{32,}$/.test(apiKey.trim());
    }
    
    return false;
  }
  
  /**
   * Get the stored opacity value
   */
  public getOpacity(): number {
    const config = this.loadConfig();
    return config.opacity !== undefined ? config.opacity : 1.0;
  }

  /**
   * Set the window opacity value
   */
  public setOpacity(opacity: number): void {
    // Ensure opacity is between 0.1 and 1.0
    const validOpacity = Math.min(1.0, Math.max(0.1, opacity));
    this.updateConfig({ opacity: validOpacity });
  }  
  
  /**
   * Get the preferred programming language
   */
  public getLanguage(): string {
    const config = this.loadConfig();
    return config.language || "python";
  }

  /**
   * Set the preferred programming language
   */
  public setLanguage(language: string): void {
    this.updateConfig({ language });
  }
  
  /**
   * Test API key with the selected provider
   */
  public async testApiKey(apiKey: string, provider?: "openai" | "gemini" | "openrouter"): Promise<{valid: boolean, error?: string}> {
    // Auto-detect provider based on key format if not specified
    if (!provider) {
      if (apiKey.trim().startsWith('sk-or-')) {
        provider = "openrouter";
        console.log("Auto-detected OpenRouter API key format for testing");
      } else if (apiKey.trim().startsWith('sk-')) {
        provider = "openai";
        console.log("Auto-detected OpenAI API key format for testing");
      } else {
        provider = "gemini";
        console.log("Using Gemini API key format for testing (default)");
      }
    }
    
    if (provider === "openai") {
      return this.testOpenAIKey(apiKey);
    } else if (provider === "gemini") {
      return this.testGeminiKey(apiKey);
    } else if (provider === "openrouter") {
      return this.testOpenRouterKey(apiKey);
    }
    
    return { valid: false, error: "Unknown API provider" };
  }
  
  /**
   * Test OpenAI API key
   */
  private async testOpenAIKey(apiKey: string): Promise<{valid: boolean, error?: string}> {
    try {
      const openai = new OpenAI({ apiKey });
      // Make a simple API call to test the key
      await openai.models.list();
      return { valid: true };
    } catch (error: any) {
      console.error('OpenAI API key test failed:', error);
      
      // Determine the specific error type for better error messages
      let errorMessage = 'Unknown error validating OpenAI API key';
      
      if (error.status === 401) {
        errorMessage = 'Invalid API key. Please check your OpenAI key and try again.';
      } else if (error.status === 429) {
        errorMessage = 'Rate limit exceeded. Your OpenAI API key has reached its request limit or has insufficient quota.';
      } else if (error.status === 500) {
        errorMessage = 'OpenAI server error. Please try again later.';
      } else if (error.message) {
        errorMessage = `Error: ${error.message}`;
      }
      
      return { valid: false, error: errorMessage };
    }
  }
  
  /**
   * Test Gemini API key
   * Note: This is a simplified implementation since we don't have the actual Gemini client
   */
  private async testGeminiKey(apiKey: string): Promise<{valid: boolean, error?: string}> {
    try {
      // For now, we'll just do a basic check to ensure the key exists and has valid format
      // In production, you would connect to the Gemini API and validate the key
      if (apiKey && apiKey.trim().length >= 20) {
        // Here you would actually validate the key with a Gemini API call
        return { valid: true };
      }
      return { valid: false, error: 'Invalid Gemini API key format.' };
    } catch (error: any) {
      console.error('Gemini API key test failed:', error);
      let errorMessage = 'Unknown error validating Gemini API key';
      
      if (error.message) {
        errorMessage = `Error: ${error.message}`;
      }
      
      return { valid: false, error: errorMessage };
    }
  }

  /**
   * Test OpenRouter API key
   */
  private async testOpenRouterKey(apiKey: string): Promise<{valid: boolean, error?: string}> {
    try {
      // For now, we'll just do a basic check to ensure the key exists and has valid format
      // In production, you would connect to the OpenRouter API and validate the key
      if (apiKey && /^sk-or-[a-zA-Z0-9]{32,}$/.test(apiKey.trim())) {
        // Here you would actually validate the key with an OpenRouter API call
        return { valid: true };
      }
      return { valid: false, error: 'Invalid OpenRouter API key format.' };
    } catch (error: any) {
      console.error('OpenRouter API key test failed:', error);
      let errorMessage = 'Unknown error validating OpenRouter API key';
      
      if (error.message) {
        errorMessage = `Error: ${error.message}`;
      }
      
      return { valid: false, error: errorMessage };
    }
  }
}

// Export a singleton instance
export const configHelper = new ConfigHelper();
