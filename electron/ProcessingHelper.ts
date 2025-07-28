// ProcessingHelper.ts
import fs from "node:fs"
import path from "node:path"
import { ScreenshotHelper } from "./ScreenshotHelper"
import { IProcessingHelperDeps } from "./main"
import * as axios from "axios"
import { app, BrowserWindow, dialog } from "electron"
import { OpenAI } from "openai"
import { configHelper } from "./ConfigHelper"

// Interface for Gemini API requests
interface GeminiMessage {
  role: string;
  parts: Array<{
    text?: string;
    inlineData?: {
      mimeType: string;
      data: string;
    }
  }>;
}

interface GeminiResponse {
  candidates: Array<{
    content: {
      parts: Array<{
        text: string;
      }>;
    };
    finishReason: string;
  }>;
}

export class ProcessingHelper {
  private deps: IProcessingHelperDeps
  private screenshotHelper: ScreenshotHelper
  private openaiClient: OpenAI | null = null
  private geminiApiKey: string | null = null
  private openrouterClient: OpenAI | null = null // OpenRouter uses OpenAI-compatible API
  
  // Flag to prevent repeated API key error notifications
  private apiKeyErrorShown: boolean = false

  // AbortControllers for API requests
  private currentProcessingAbortController: AbortController | null = null
  private currentExtraProcessingAbortController: AbortController | null = null

  constructor(deps: IProcessingHelperDeps) {
    this.deps = deps
    this.screenshotHelper = deps.getScreenshotHelper()
    
    // Initialize AI client based on config
    this.initializeAIClient();
    
    // Listen for config changes to re-initialize the AI client
    configHelper.on('config-updated', () => {
      this.initializeAIClient();
    });
  }
  
  /**
   * Initialize or reinitialize the AI client with current config
   */
  private initializeAIClient(): void {
    try {
      const config = configHelper.loadConfig();
      
      if (config.apiProvider === "openai") {
        const apiKey = config.openaiApiKey || config.apiKey; // Support legacy key
        if (apiKey) {
          this.openaiClient = new OpenAI({ 
            apiKey: apiKey,
            timeout: 60000, // 60 second timeout
            maxRetries: 2   // Retry up to 2 times
          });
          this.geminiApiKey = null;
          this.openrouterClient = null;
          console.log("OpenAI client initialized successfully");
          this.apiKeyErrorShown = false; // Reset error flag on successful initialization
        } else {
          this.openaiClient = null;
          this.geminiApiKey = null;
          this.openrouterClient = null;
          console.warn("No API key available, OpenAI client not initialized");
        }
      } else if (config.apiProvider === "gemini"){
        // Gemini client initialization
        this.openaiClient = null;
        this.openrouterClient = null;
        const apiKey = config.geminiApiKey || config.apiKey; // Support legacy key
        if (apiKey) {
          this.geminiApiKey = apiKey;
          console.log("Gemini API key set successfully");
          this.apiKeyErrorShown = false; // Reset error flag on successful initialization
        } else {
          this.openaiClient = null;
          this.geminiApiKey = null;
          this.openrouterClient = null;
          console.warn("No API key available, Gemini client not initialized");
        }
      } else if (config.apiProvider === "openrouter") {
        // Reset other clients
        this.openaiClient = null;
        this.geminiApiKey = null;
        const apiKey = config.openrouterApiKey || config.apiKey; // Support legacy key
        if (apiKey) {
          this.openrouterClient = new OpenAI({
            apiKey: apiKey,
            baseURL: "https://openrouter.ai/api/v1",
            timeout: 60000,
            maxRetries: 2
          });
          console.log("OpenRouter client initialized successfully");
        } else {
          this.openaiClient = null;
          this.geminiApiKey = null;
          this.openrouterClient = null;
          console.warn("No API key available, OpenRouter client not initialized");
        }
      }
    } catch (error) {
      console.error("Failed to initialize AI client:", error);
      this.openaiClient = null;
      this.geminiApiKey = null;
      this.openrouterClient = null;
    }
  }

  private async waitForInitialization(
    mainWindow: BrowserWindow
  ): Promise<void> {
    let attempts = 0
    const maxAttempts = 50 // 5 seconds total

    while (attempts < maxAttempts) {
      const isInitialized = await mainWindow.webContents.executeJavaScript(
        "window.__IS_INITIALIZED__"
      )
      if (isInitialized) return
      await new Promise((resolve) => setTimeout(resolve, 100))
      attempts++
    }
    throw new Error("App failed to initialize after 5 seconds")
  }

  private async getCredits(): Promise<number> {
    const mainWindow = this.deps.getMainWindow()
    if (!mainWindow) return 999 // Unlimited credits in this version

    try {
      await this.waitForInitialization(mainWindow)
      return 999 // Always return sufficient credits to work
    } catch (error) {
      console.error("Error getting credits:", error)
      return 999 // Unlimited credits as fallback
    }
  }

  private sanitizeJsonString(jsonString: string): string {
    // Remove or replace problematic control characters that can break JSON parsing
    // Only remove the most problematic control characters while preserving valid JSON structure
    let sanitized = jsonString
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove most control characters except \t, \n, \r
      .replace(/\u0000/g, '') // Remove null characters
      .replace(/\u0008/g, '') // Remove backspace
      .replace(/\u000C/g, '') // Remove form feed
      .trim();
    
    // Try to fix common JSON issues
    // Remove any trailing commas before closing braces/brackets
    sanitized = sanitized.replace(/,(\s*[}\]])/g, '$1');
    
    // If the JSON seems to be cut off (unterminated string), try to fix it
    if (sanitized.includes('"') && !this.isValidJsonStructure(sanitized)) {
      // Try to close unterminated strings
      const openQuotes = (sanitized.match(/"/g) || []).length;
      if (openQuotes % 2 !== 0) {
        // Add closing quote for the last unterminated string
        sanitized += '"';
      }
      
      // Try to close any unclosed objects/arrays
      const openBraces = (sanitized.match(/\{/g) || []).length;
      const closeBraces = (sanitized.match(/\}/g) || []).length;
      const openBrackets = (sanitized.match(/\[/g) || []).length;
      const closeBrackets = (sanitized.match(/\]/g) || []).length;
      
      // Add missing closing braces
      for (let i = 0; i < openBraces - closeBraces; i++) {
        sanitized += '}';
      }
      
      // Add missing closing brackets
      for (let i = 0; i < openBrackets - closeBraces; i++) {
        sanitized += ']';
      }
    }
    
    return sanitized;
  }
  
  private isValidJsonStructure(jsonString: string): boolean {
    try {
      JSON.parse(jsonString);
      return true;
    } catch {
      return false;
    }
  }

  private async getLanguage(): Promise<string> {
    try {
      // Get language from config
      const config = configHelper.loadConfig();
      if (config.language) {
        return config.language;
      }
      
      // Fallback to window variable if config doesn't have language
      const mainWindow = this.deps.getMainWindow()
      if (mainWindow) {
        try {
          await this.waitForInitialization(mainWindow)
          const language = await mainWindow.webContents.executeJavaScript(
            "window.__LANGUAGE__"
          )

          if (
            typeof language === "string" &&
            language !== undefined &&
            language !== null
          ) {
            return language;
          }
        } catch (err) {
          console.warn("Could not get language from window", err);
        }
      }
      
      // Default fallback
      return "python";
    } catch (error) {
      console.error("Error getting language:", error)
      return "python"
    }
  }

  public async processScreenshots(): Promise<void> {
    const mainWindow = this.deps.getMainWindow()
    if (!mainWindow) return

    const config = configHelper.loadConfig();
    
    // First verify we have a valid AI client
    if (config.apiProvider === "openai" && !this.openaiClient) {
      this.initializeAIClient();
      
      if (!this.openaiClient && !this.apiKeyErrorShown) {
        console.error("OpenAI client not initialized");
        this.apiKeyErrorShown = true;
        mainWindow.webContents.send(
          this.deps.PROCESSING_EVENTS.API_KEY_INVALID
        );
        return;
      } else if (!this.openaiClient) {
        // Already shown error, just return
        return;
      }
    } else if (config.apiProvider === "gemini" && !this.geminiApiKey) {
      this.initializeAIClient();
      
      if (!this.geminiApiKey && !this.apiKeyErrorShown) {
        console.error("Gemini API key not initialized");
        this.apiKeyErrorShown = true;
        mainWindow.webContents.send(
          this.deps.PROCESSING_EVENTS.API_KEY_INVALID
        );
        return;
      } else if (!this.geminiApiKey) {
        // Already shown error, just return
        return;
      }
    }

    const view = this.deps.getView()
    console.log("Processing screenshots in view:", view)

    if (view === "queue") {
      mainWindow.webContents.send(this.deps.PROCESSING_EVENTS.INITIAL_START)
      const screenshotQueue = this.screenshotHelper.getScreenshotQueue()
      console.log("Processing main queue screenshots:", screenshotQueue)
      
      // Check if the queue is empty
      if (!screenshotQueue || screenshotQueue.length === 0) {
        console.log("No screenshots found in queue");
        mainWindow.webContents.send(this.deps.PROCESSING_EVENTS.NO_SCREENSHOTS);
        return;
      }

      // Check that files actually exist
      const existingScreenshots = screenshotQueue.filter(path => fs.existsSync(path));
      if (existingScreenshots.length === 0) {
        console.log("Screenshot files don't exist on disk");
        mainWindow.webContents.send(this.deps.PROCESSING_EVENTS.NO_SCREENSHOTS);
        return;
      }

      try {
        // Initialize AbortController
        this.currentProcessingAbortController = new AbortController()
        const { signal } = this.currentProcessingAbortController

        const screenshots = await Promise.all(
          existingScreenshots.map(async (path) => {
            try {
              return {
                path,
                preview: await this.screenshotHelper.getImagePreview(path),
                data: fs.readFileSync(path).toString('base64')
              };
            } catch (err) {
              console.error(`Error reading screenshot ${path}:`, err);
              return null;
            }
          })
        )

        // Filter out any nulls from failed screenshots
        const validScreenshots = screenshots.filter(Boolean);
        
        if (validScreenshots.length === 0) {
          throw new Error("Failed to load screenshot data");
        }

        // Check solving mode and call appropriate processing method
        const result = config.solvingMode === "mcq" 
          ? await this.processMCQScreenshotsHelper(validScreenshots, signal)
          : await this.processScreenshotsHelper(validScreenshots, signal);

        if (!result.success) {
          console.log("Processing failed:", result.error)
          if (result.error?.includes("API Key") || result.error?.includes("OpenAI") || result.error?.includes("Gemini")) {
            mainWindow.webContents.send(
              this.deps.PROCESSING_EVENTS.API_KEY_INVALID
            )
          } else {
            mainWindow.webContents.send(
              this.deps.PROCESSING_EVENTS.INITIAL_SOLUTION_ERROR,
              result.error
            )
          }
          // Reset view back to queue on error
          console.log("Resetting view to queue due to error")
          this.deps.setView("queue")
          return
        }

        // Only set view to solutions if processing succeeded
        console.log("Setting view to solutions after successful processing")
        mainWindow.webContents.send(
          this.deps.PROCESSING_EVENTS.SOLUTION_SUCCESS,
          result.data
        )
        this.deps.setView("solutions")
      } catch (error: any) {
        mainWindow.webContents.send(
          this.deps.PROCESSING_EVENTS.INITIAL_SOLUTION_ERROR,
          error
        )
        console.error("Processing error:", error)
        if (axios.isCancel(error)) {
          mainWindow.webContents.send(
            this.deps.PROCESSING_EVENTS.INITIAL_SOLUTION_ERROR,
            "Processing was canceled by the user."
          )
        } else {
          mainWindow.webContents.send(
            this.deps.PROCESSING_EVENTS.INITIAL_SOLUTION_ERROR,
            error.message || "Server error. Please try again."
          )
        }
        // Reset view back to queue on error
        console.log("Resetting view to queue due to error")
        this.deps.setView("queue")
      } finally {
        this.currentProcessingAbortController = null
      }
    } else {
      // view == 'solutions'
      const extraScreenshotQueue =
        this.screenshotHelper.getExtraScreenshotQueue()
      console.log("Processing extra queue screenshots:", extraScreenshotQueue)
      
      // Check if the extra queue is empty
      if (!extraScreenshotQueue || extraScreenshotQueue.length === 0) {
        console.log("No extra screenshots found in queue");
        mainWindow.webContents.send(this.deps.PROCESSING_EVENTS.NO_SCREENSHOTS);
        
        return;
      }

      // Check that files actually exist
      const existingExtraScreenshots = extraScreenshotQueue.filter(path => fs.existsSync(path));
      if (existingExtraScreenshots.length === 0) {
        console.log("Extra screenshot files don't exist on disk");
        mainWindow.webContents.send(this.deps.PROCESSING_EVENTS.NO_SCREENSHOTS);
        return;
      }
      
      mainWindow.webContents.send(this.deps.PROCESSING_EVENTS.DEBUG_START)

      // Initialize AbortController
      this.currentExtraProcessingAbortController = new AbortController()
      const { signal } = this.currentExtraProcessingAbortController

      try {
        // Get all screenshots (both main and extra) for processing
        const allPaths = [
          ...this.screenshotHelper.getScreenshotQueue(),
          ...existingExtraScreenshots
        ];
        
        const screenshots = await Promise.all(
          allPaths.map(async (path) => {
            try {
              if (!fs.existsSync(path)) {
                console.warn(`Screenshot file does not exist: ${path}`);
                return null;
              }
              
              return {
                path,
                preview: await this.screenshotHelper.getImagePreview(path),
                data: fs.readFileSync(path).toString('base64')
              };
            } catch (err) {
              console.error(`Error reading screenshot ${path}:`, err);
              return null;
            }
          })
        )
        
        // Filter out any nulls from failed screenshots
        const validScreenshots = screenshots.filter(Boolean);
        
        if (validScreenshots.length === 0) {
          throw new Error("Failed to load screenshot data for debugging");
        }
        
        console.log(
          "Combined screenshots for processing:",
          validScreenshots.map((s) => s.path)
        )

        const result = await this.processExtraScreenshotsHelper(
          validScreenshots,
          signal
        )

        if (result.success) {
          this.deps.setHasDebugged(true)
          mainWindow.webContents.send(
            this.deps.PROCESSING_EVENTS.DEBUG_SUCCESS,
            result.data
          )
        } else {
          mainWindow.webContents.send(
            this.deps.PROCESSING_EVENTS.DEBUG_ERROR,
            result.error
          )
        }
      } catch (error: any) {
        if (axios.isCancel(error)) {
          mainWindow.webContents.send(
            this.deps.PROCESSING_EVENTS.DEBUG_ERROR,
            "Extra processing was canceled by the user."
          )
        } else {
          mainWindow.webContents.send(
            this.deps.PROCESSING_EVENTS.DEBUG_ERROR,
            error.message
          )
        }
      } finally {
        this.currentExtraProcessingAbortController = null
      }
    }
  }

  private async processScreenshotsHelper(
    screenshots: Array<{ path: string; data: string }>,
    signal: AbortSignal
  ) {
    try {
      const config = configHelper.loadConfig();
      const language = await this.getLanguage();
      const mainWindow = this.deps.getMainWindow();
      
      // Step 1: Extract problem info using AI Vision API (OpenAI or Gemini)
      const imageDataList = screenshots.map(screenshot => screenshot.data);
      
      // Update the user on progress
      if (mainWindow) {
        mainWindow.webContents.send("processing-status", {
          message: "Analyzing problem from screenshots...",
          progress: 20
        });
      }

      let problemInfo;
      
      if (config.apiProvider === "openai") {
        // Verify OpenAI client
        if (!this.openaiClient) {
          this.initializeAIClient(); // Try to reinitialize
          
          if (!this.openaiClient) {
            return {
              success: false,
              error: "OpenAI API key not configured or invalid. Please check your settings."
            };
          }
        }

        // Use OpenAI for processing
        const messages = [
          {
            role: "system" as const, 
            content: "You are a coding challenge interpreter. Analyze the screenshot of the coding problem and extract all relevant information. Return the information in JSON format with these fields: problem_statement, constraints, example_input, example_output. Just return the structured JSON without any other text."
          },
          {
            role: "user" as const,
            content: [
              {
                type: "text" as const, 
                text: `Extract the coding problem details from these screenshots. Return in JSON format. Preferred coding language we gonna use for this problem is ${language}.`
              },
              ...imageDataList.map(data => ({
                type: "image_url" as const,
                image_url: { url: `data:image/png;base64,${data}` }
              }))
            ]
          }
        ];

        // Send to OpenAI Vision API
        const extractionResponse = await this.openaiClient.chat.completions.create({
          model: config.extractionModel || "gpt-4o",
          messages: messages,
          max_tokens: 16000, // Increased from 8000 to prevent MAX_TOKENS truncation
          temperature: 0.2
        });

        // Parse the response
        try {
          const responseText = extractionResponse.choices[0].message.content;
          // Handle when OpenAI might wrap the JSON in markdown code blocks
          const jsonText = responseText.replace(/```json|```/g, '').trim();
          problemInfo = JSON.parse(jsonText);
        } catch (error) {
          console.error("Error parsing OpenAI response:", error);
          return {
            success: false,
            error: "Failed to parse problem information. Please try again or use clearer screenshots."
          };
        }
      } else if (config.apiProvider === "gemini")  {
        // Use Gemini API
        if (!this.geminiApiKey) {
          return {
            success: false,
            error: "Gemini API key not configured. Please check your settings."
          };
        }

        try {
          // Create Gemini message structure
          const geminiMessages: GeminiMessage[] = [
            {
              role: "user",
              parts: [
                {
                  text: `You are a coding challenge interpreter. Analyze the screenshots of the coding problem and extract all relevant information. Return the information in JSON format with these fields: problem_statement, constraints, example_input, example_output. Just return the structured JSON without any other text. Preferred coding language we gonna use for this problem is ${language}.`
                },
                ...imageDataList.map(data => ({
                  inlineData: {
                    mimeType: "image/png",
                    data: data
                  }
                }))
              ]
            }
          ];

          // Make API request to Gemini
          const response = await axios.default.post(
            `https://generativelanguage.googleapis.com/v1beta/models/${config.extractionModel || "gemini-2.0-flash"}:generateContent?key=${this.geminiApiKey}`,
            {
              contents: geminiMessages,
              generationConfig: {
                temperature: 0.2,
                maxOutputTokens: 16000 // Increased from 8000 to prevent MAX_TOKENS truncation
              }
            },
            { signal }
          );

          const responseData = response.data as GeminiResponse;
          
          // Validate Gemini response structure with better error handling for MAX_TOKENS
          if (!responseData || !responseData.candidates || !Array.isArray(responseData.candidates) || responseData.candidates.length === 0) {
            console.error("Invalid Gemini response structure:", responseData);
            return {
              success: false,
              error: "Empty or invalid response from Gemini API"
            };
          }
          
          const candidate = responseData.candidates[0];
          
          // Check for MAX_TOKENS or other finish reasons that might affect content structure
          if (candidate && candidate.finishReason === 'MAX_TOKENS') {
            console.error("Gemini API response truncated due to MAX_TOKENS:", candidate);
            return {
              success: false,
              error: "Response was truncated due to token limit. Please try with a shorter prompt or increase model's max tokens."
            };
          }
          
          if (!candidate || !candidate.content || !candidate.content.parts || !Array.isArray(candidate.content.parts) || candidate.content.parts.length === 0) {
            console.error("Invalid candidate structure:", candidate);
            
            // Provide more specific error messages based on the structure
            if (candidate && candidate.finishReason) {
              return {
                success: false,
                error: `Gemini API response incomplete. Finish reason: ${candidate.finishReason}. Please try again or use a different model.`
              };
            }
            
            return {
              success: false,
              error: "Invalid response structure from Gemini API. The response may be incomplete or malformed."
            };
          }
          
          const responsePart = candidate.content.parts[0];
          if (!responsePart || !responsePart.text) {
            console.error("Invalid response part:", responsePart);
            return {
              success: false,
              error: "No text content in Gemini API response. The response may be empty or incomplete."
            };
          }
          
          const responseText = responsePart.text;
          
          // Handle when Gemini might wrap the JSON in markdown code blocks
          const jsonText = responseText.replace(/```json|```/g, '').trim();
          problemInfo = JSON.parse(jsonText);
        } catch (error) {
          console.error("Error using Gemini API:", error);
          
          // Enhanced error handling for Gemini API specific errors
          if (error instanceof Error) {
            if (error.message.includes("MAX_TOKENS") || error.message.includes("token limit")) {
              throw new Error("Response was truncated due to token limit. Please try with a shorter prompt or increase model's max tokens.");
            }
            if (error.message.includes("finish reason")) {
              throw new Error(error.message);
            }
            if (error.message.includes("Invalid candidate structure")) {
              throw new Error("The API response was incomplete or malformed. This may be due to content filtering or API limits. Please try again with a different prompt.");
            }
          }
          
          throw new Error("Failed to process with Gemini API. Please check your API key or try again later.");
        }
      } else if (config.apiProvider === "openrouter") {
        // OpenRouter processing using OpenAI-compatible API
        if (!this.openrouterClient) {
          return {
            success: false,
            error: "OpenRouter API key not configured. Please check your settings."
          };
        }

        try {
          const imageMessages = imageDataList.map(data => ({
            type: "image_url" as const,
            image_url: {
              url: `data:image/png;base64,${data}`,
              detail: "high" as const
            }
          }));

          const response = await this.openrouterClient.chat.completions.create({
            model: config.extractionModel || config.openrouterModel || "meta-llama/llama-3.1-8b-instruct:free",
            messages: [
              { 
                role: "system", 
                content: "You are an expert at analyzing coding problem screenshots and extracting structured information." 
              },
              {
                role: "user",
                content: [
                  {
                    type: "text",
                    text: `Extract the coding problem details from these screenshots. Return in JSON format with these fields: problem_statement, constraints, example_input, example_output. Preferred coding language is ${language}.`
                  },
                  ...imageMessages
                ]
              }
            ],
            max_tokens: 16000, // Increased from 8000 to prevent MAX_TOKENS truncation
            temperature: 0.2
          });

          const responseContent = response.choices[0].message.content;
          if (!responseContent) {
            throw new Error("Empty response from OpenRouter API");
          }

          const jsonText = responseContent.replace(/```json|```/g, '').trim();
          problemInfo = JSON.parse(jsonText);
        } catch (error) {
          console.error("Error using OpenRouter API:", error);
          return {
            success: false,
            error: "Failed to process with OpenRouter API. Please check your API key or try again later."
          };
        }
      }
      
      // Update the user on progress
      if (mainWindow) {
        mainWindow.webContents.send("processing-status", {
          message: "Problem analyzed successfully. Preparing to generate solution...",
          progress: 40
        });
      }

      // Store problem info in AppState
      this.deps.setProblemInfo(problemInfo);

      // Send first success event
      if (mainWindow) {
        mainWindow.webContents.send(
          this.deps.PROCESSING_EVENTS.PROBLEM_EXTRACTED,
          problemInfo
        );

        // Generate solutions after successful extraction
        const solutionsResult = await this.generateSolutionsHelper(signal);
        if (solutionsResult.success) {
          // Clear any existing extra screenshots before transitioning to solutions view
          this.screenshotHelper.clearExtraScreenshotQueue();
          
          // Final progress update
          mainWindow.webContents.send("processing-status", {
            message: "Solution generated successfully",
            progress: 100
          });
          
          mainWindow.webContents.send(
            this.deps.PROCESSING_EVENTS.SOLUTION_SUCCESS,
            solutionsResult.data
          );
          return { success: true, data: solutionsResult.data };
        } else {
          throw new Error(
            solutionsResult.error || "Failed to generate solutions"
          );
        }
      }

      return { success: false, error: "Failed to process screenshots" };
    } catch (error: any) {
      // If the request was cancelled, don't retry
      if (axios.isCancel(error)) {
        return {
          success: false,
          error: "Processing was canceled by the user."
        };
      }
      
      // Handle OpenAI API errors specifically
      if (error?.response?.status === 401) {
        return {
          success: false,
          error: "Invalid OpenAI API key. Please check your settings."
        };
      } else if (error?.response?.status === 429) {
        return {
          success: false,
          error: "OpenAI API rate limit exceeded or insufficient credits. Please try again later."
        };
      } else if (error?.response?.status === 500) {
        return {
          success: false,
          error: "OpenAI server error. Please try again later."
        };
      }

      console.error("API Error Details:", error);
      return { 
        success: false, 
        error: error.message || "Failed to process screenshots. Please try again." 
      };
    }
  }

  private async generateSolutionsHelper(signal: AbortSignal) {
    try {
      const problemInfo = this.deps.getProblemInfo();
      const language = await this.getLanguage();
      const config = configHelper.loadConfig();
      const mainWindow = this.deps.getMainWindow();

      if (!problemInfo) {
        throw new Error("No problem info available");
      }

      // Update progress status
      if (mainWindow) {
        mainWindow.webContents.send("processing-status", {
          message: "Creating optimal solution with detailed explanations...",
          progress: 60
        });
      }

      // Create prompt for solution generation
      const promptText = `
Generate a detailed solution for the following coding problem:

PROBLEM STATEMENT:
${problemInfo.problem_statement}

CONSTRAINTS:
${problemInfo.constraints || "No specific constraints provided."}

EXAMPLE INPUT:
${problemInfo.example_input || "No example input provided."}

EXAMPLE OUTPUT:
${problemInfo.example_output || "No example output provided."}

LANGUAGE: ${language}

I need the response in the following format:
1. Code: A clean, optimized implementation in ${language}
2. Your Thoughts: A list of key insights and reasoning behind your approach
3. Time complexity: O(X) with a detailed explanation (at least 2 sentences)
4. Space complexity: O(X) with a detailed explanation (at least 2 sentences)

For complexity explanations, please be thorough. For example: "Time complexity: O(n) because we iterate through the array only once. This is optimal as we need to examine each element at least once to find the solution." or "Space complexity: O(n) because in the worst case, we store all elements in the hashmap. The additional space scales linearly with the input size."

Your solution should be efficient, well-commented, and handle edge cases.
`;

      let responseContent;
      
      if (config.apiProvider === "openai") {
        // OpenAI processing
        if (!this.openaiClient) {
          return {
            success: false,
            error: "OpenAI API key not configured. Please check your settings."
          };
        }
        
        // Send to OpenAI API
        const solutionResponse = await this.openaiClient.chat.completions.create({
          model: config.solutionModel || "gpt-4o",
          messages: [
            { role: "system", content: "You are an expert coding interview assistant. Provide clear, optimal solutions with detailed explanations." },
            { role: "user", content: promptText }
          ],
          max_tokens: 16000, // Increased from 8000 to prevent MAX_TOKENS truncation
          temperature: 0.2
        });

        responseContent = solutionResponse.choices[0].message.content;
      } else if (config.apiProvider === "gemini")  {
        // Gemini processing
        if (!this.geminiApiKey) {
          return {
            success: false,
            error: "Gemini API key not configured. Please check your settings."
          };
        }
        
        try {
          // Create Gemini message structure
          const geminiMessages = [
            {
              role: "user",
              parts: [
                {
                  text: `You are an expert coding interview assistant. Provide a clear, optimal solution with detailed explanations for this problem:\n\n${promptText}`
                }
              ]
            }
          ];

          // Make API request to Gemini
          const response = await axios.default.post(
            `https://generativelanguage.googleapis.com/v1beta/models/${config.mcqModel || "gemini-2.5-flash"}:generateContent?key=${this.geminiApiKey}`,
            {
              contents: geminiMessages,
              generationConfig: {
                temperature: 0.2,
                maxOutputTokens: 16000 // Increased from 8000 to prevent MAX_TOKENS truncation
              }
            },
            { signal }
          );

          const responseData = response.data as GeminiResponse;
          
          // Helper method to validate Gemini response structure
          const validateGeminiResponse = (responseData: any): { success: boolean; error?: string; text?: string } => {
            if (!responseData) {
              return { success: false, error: "No response data from Gemini API" };
            }
            
            if (!responseData.candidates || !Array.isArray(responseData.candidates) || responseData.candidates.length === 0) {
              console.error("Invalid Gemini response structure:", responseData);
              return { success: false, error: "Empty or invalid candidates array from Gemini API" };
            }
            
            const candidate = responseData.candidates[0];
            
            // Check for MAX_TOKENS or other finish reasons that might affect content structure
            if (candidate && candidate.finishReason === 'MAX_TOKENS') {
              console.error("Gemini API response truncated due to MAX_TOKENS:", candidate);
              return { success: false, error: "Response was truncated due to token limit. Please try with a shorter prompt or increase model's max tokens." };
            }
            
            if (!candidate || !candidate.content || !candidate.content.parts || !Array.isArray(candidate.content.parts) || candidate.content.parts.length === 0) {
              console.error("Invalid candidate structure:", candidate);
              
              // Provide more specific error messages based on the structure
              if (candidate && candidate.finishReason) {
                return { success: false, error: `Gemini API response incomplete. Finish reason: ${candidate.finishReason}. Please try again or use a different model.` };
              }
              
              return { success: false, error: "Invalid response structure from Gemini API. The response may be incomplete or malformed." };
            }
            
            const responsePart = candidate.content.parts[0];
            if (!responsePart || !responsePart.text) {
              console.error("Invalid response part:", responsePart);
              return { success: false, error: "No text content in Gemini API response. The response may be empty or incomplete." };
            }
            
            return { success: true, text: responsePart.text };
          }

          const validationResult = validateGeminiResponse(responseData);
          if (!validationResult.success) {
            return {
              success: false,
              error: validationResult.error
            };
          }
          
          responseContent = validationResult.text;
        } catch (error) {
          console.error("Error using Gemini API for solution:", error);
          return {
            success: false,
            error: "Failed to generate solution with Gemini API. Please check your API key or try again later."
          };
        }
      } else if (config.apiProvider === "openrouter") {
        // OpenRouter processing
        if (!this.openrouterClient) {
          return {
            success: false,
            error: "OpenRouter API key not configured. Please check your settings."
          };
        }

        try {
          const solutionResponse = await this.openrouterClient.chat.completions.create({
            model: config.solutionModel || config.openrouterModel || "meta-llama/llama-3.1-8b-instruct:free",
            messages: [
              { role: "system", content: "You are an expert coding interview assistant. Provide clear, optimal solutions with detailed explanations." },
              { role: "user", content: promptText }
            ],
            max_tokens: 16000, // Increased from 8000 to prevent MAX_TOKENS truncation
            temperature: 0.2
          });

          responseContent = solutionResponse.choices[0].message.content;
        } catch (error) {
          console.error("Error using OpenRouter API for solution:", error);
          return {
            success: false,
            error: "Failed to generate solution with OpenRouter API. Please check your API key or try again later."
          };
        }
      }
      
      // Extract parts from the response
      const codeMatch = responseContent.match(/```(?:\w+)?\s*([\s\S]*?)```/);
      const code = codeMatch ? codeMatch[1].trim() : responseContent;
      
      // Extract thoughts, looking for bullet points or numbered lists
      const thoughtsRegex = /(?:Thoughts:|Key Insights:|Reasoning:|Approach:)([\s\S]*?)(?=\n\s*(?:Space complexity|$))/i;
      const thoughtsMatch = responseContent.match(thoughtsRegex);
      let thoughts: string[] = [];
      
      if (thoughtsMatch && thoughtsMatch[1]) {
        // Extract bullet points or numbered items
        const bulletPoints = thoughtsMatch[1].match(/(?:^|\n)\s*(?:[-*•]|\d+\.)\s*(.*)/g);
        if (bulletPoints) {
          thoughts = bulletPoints.map(point => 
            point.replace(/^\s*(?:[-*•]|\d+\.)\s*/, '').trim()
          ).filter(Boolean);
        } else {
          // If no bullet points found, split by newlines and filter empty lines
          thoughts = thoughtsMatch[1].split('\n')
            .map((line) => line.trim())
            .filter(Boolean);
        }
      }
      
      // Extract complexity information
      const timeComplexityPattern = /Time complexity:?\s*([^\n]+(?:\n[^\n]+)*?)(?=\n\s*(?:Space complexity|$))/i;
      const spaceComplexityPattern = /Space complexity:?\s*([^\n]+(?:\n[^\n]+)*?)(?=\n\s*(?:[A-Z]|$))/i;
      
      let timeComplexity = "O(n) - Linear time complexity because we only iterate through the array once. Each element is processed exactly one time, and the hashmap lookups are O(1) operations.";
      let spaceComplexity = "O(n) - Linear space complexity because we store elements in the hashmap. In the worst case, we might need to store all elements before finding the solution pair.";
      
      const timeMatch = responseContent.match(timeComplexityPattern);
      if (timeMatch && timeMatch[1]) {
        timeComplexity = timeMatch[1].trim();
        if (!timeComplexity.match(/O\([^)]+\)/i)) {
          timeComplexity = `O(n) - ${timeComplexity}`;
        } else if (!timeComplexity.includes('-') && !timeComplexity.includes('because')) {
          const notationMatch = timeComplexity.match(/O\([^)]+\)/i);
          if (notationMatch) {
            const notation = notationMatch[0];
            const rest = timeComplexity.replace(notation, '').trim();
            timeComplexity = `${notation} - ${rest}`;
          }
        }
      }
      
      const spaceMatch = responseContent.match(spaceComplexityPattern);
      if (spaceMatch && spaceMatch[1]) {
        spaceComplexity = spaceMatch[1].trim();
        if (!spaceComplexity.match(/O\([^)]+\)/i)) {
          spaceComplexity = `O(n) - ${spaceComplexity}`;
        } else if (!spaceComplexity.includes('-') && !spaceComplexity.includes('because')) {
          const notationMatch = spaceComplexity.match(/O\([^)]+\)/i);
          if (notationMatch) {
            const notation = notationMatch[0];
            const rest = spaceComplexity.replace(notation, '').trim();
            spaceComplexity = `${notation} - ${rest}`;
          }
        }
      }

      const formattedResponse = {
        code: code,
        thoughts: thoughts.length > 0 ? thoughts : ["Solution approach based on efficiency and readability"],
        time_complexity: timeComplexity,
        space_complexity: spaceComplexity
      };

      return { success: true, data: formattedResponse };
    } catch (error: any) {
      if (axios.isCancel(error)) {
        return {
          success: false,
          error: "Processing was canceled by the user."
        };
      }
      
      if (error?.response?.status === 401) {
        return {
          success: false,
          error: "Invalid OpenAI API key. Please check your settings."
        };
      } else if (error?.response?.status === 429) {
        return {
          success: false,
          error: "OpenAI API rate limit exceeded or insufficient credits. Please try again later."
        };
      } else if (error?.response?.status === 500) {
        return {
          success: false,
          error: "OpenAI server error. Please try again later."
        };
      }

      console.error("Solution generation error:", error);
      return { success: false, error: error.message || "Failed to generate solution" };
    }
  }

  private async processExtraScreenshotsHelper(
    screenshots: Array<{ path: string; data: string }>,
    signal: AbortSignal
  ) {
    try {
      const problemInfo = this.deps.getProblemInfo();
      const language = await this.getLanguage();
      const config = configHelper.loadConfig();
      const mainWindow = this.deps.getMainWindow();

      if (!problemInfo) {
        throw new Error("No problem info available");
      }

      // Update progress status
      if (mainWindow) {
        mainWindow.webContents.send("processing-status", {
          message: "Processing debug screenshots...",
          progress: 30
        });
      }

      // Prepare the images for the API call
      const imageDataList = screenshots.map(screenshot => screenshot.data);
      
      let debugContent;
      
      if (config.apiProvider === "openai") {
        if (!this.openaiClient) {
          return {
            success: false,
            error: "OpenAI API key not configured. Please check your settings."
          };
        }
        
        const messages = [
          {
            role: "system" as const, 
            content: `You are a coding interview assistant helping debug and improve solutions. Analyze these screenshots which include either error messages, incorrect outputs, or test cases, and provide detailed debugging help.

Your response MUST follow this exact structure with these section headers (use ### for headers):
### Issues Identified
- List each issue as a bullet point with clear explanation

### Specific Improvements and Corrections
- List specific code changes needed as bullet points

### Optimizations
- List any performance optimizations if applicable

### Explanation of Changes Needed
Here provide a clear explanation of why the changes are needed

### Key Points
- Summary bullet points of the most important takeaways

If you include code examples, use proper markdown code blocks with language specification (e.g. \`\`\`java).`
          },
          {
            role: "user" as const,
            content: [
              {
                type: "text" as const, 
                text: `I'm solving this coding problem: "${problemInfo.problem_statement}" in ${language}. I need help with debugging or improving my solution. Here are screenshots of my code, the errors or test cases. Please provide a detailed analysis with:
1. What issues you found in my code
2. Specific improvements and corrections
3. Any optimizations that would make the solution better
4. A clear explanation of the changes needed` 
              },
              ...imageDataList.map(data => ({
                type: "image_url" as const,
                image_url: { url: `data:image/png;base64,${data}` }
              }))
            ]
          }
        ];

        if (mainWindow) {
          mainWindow.webContents.send("processing-status", {
            message: "Analyzing code and generating debug feedback...",
            progress: 60
          });
        }

        const debugResponse = await this.openaiClient.chat.completions.create({
          model: config.debuggingModel || "gpt-4o",
          messages: messages,
          max_tokens: 16000, // Increased from 8000 to prevent MAX_TOKENS truncation
          temperature: 0.2
        });
        
        debugContent = debugResponse.choices[0].message.content;
      } else if (config.apiProvider === "gemini")  {
        if (!this.geminiApiKey) {
          return {
            success: false,
            error: "Gemini API key not configured. Please check your settings."
          };
        }
        
        try {
          const debugPrompt = `
You are a coding interview assistant helping debug and improve solutions. Analyze these screenshots which include either error messages, incorrect outputs, or test cases, and provide detailed debugging help.

I'm solving this coding problem: "${problemInfo.problem_statement}" in ${language}. I need help with debugging or improving my solution.

YOUR RESPONSE MUST FOLLOW THIS EXACT STRUCTURE WITH THESE SECTION HEADERS:
### Issues Identified
- List each issue as a bullet point with clear explanation

### Specific Improvements and Corrections
- List specific code changes needed as bullet points

### Optimizations
- List any performance optimizations if applicable

### Explanation of Changes Needed
Here provide a clear explanation of why the changes are needed

### Key Points
- Summary bullet points of the most important takeaways

If you include code examples, use proper markdown code blocks with language specification (e.g. \`\`\`java).
`;

          const geminiMessages = [
            {
              role: "user",
              parts: [
                { text: debugPrompt },
                ...imageDataList.map(data => ({
                  inlineData: {
                    mimeType: "image/png",
                    data: data
                  }
                }))
              ]
            }
          ];

          if (mainWindow) {
            mainWindow.webContents.send("processing-status", {
              message: "Analyzing code and generating debug feedback with Gemini...",
              progress: 60
            });
          }

          const response = await axios.default.post(
            `https://generativelanguage.googleapis.com/v1beta/models/${config.debuggingModel || "gemini-2.0-flash"}:generateContent?key=${this.geminiApiKey}`,
            {
              contents: geminiMessages,
              generationConfig: {
                temperature: 0.2,
                maxOutputTokens: 16000 // Increased from 8000 to prevent MAX_TOKENS truncation
              }
            },
            { signal }
          );

          const responseData = response.data as GeminiResponse;
          
          // Helper method to validate Gemini response structure
          const validateGeminiResponse = (responseData: any): { success: boolean; error?: string; text?: string } => {
            if (!responseData) {
              return { success: false, error: "No response data from Gemini API" };
            }
            
            if (!responseData.candidates || !Array.isArray(responseData.candidates) || responseData.candidates.length === 0) {
              console.error("Invalid Gemini response structure:", responseData);
              return { success: false, error: "Empty or invalid candidates array from Gemini API" };
            }
            
            const candidate = responseData.candidates[0];
            
            // Check for MAX_TOKENS or other finish reasons that might affect content structure
            if (candidate && candidate.finishReason === 'MAX_TOKENS') {
              console.error("Gemini API response truncated due to MAX_TOKENS:", candidate);
              return { success: false, error: "Response was truncated due to token limit. Please try with a shorter prompt or increase model's max tokens." };
            }
            
            if (!candidate || !candidate.content || !candidate.content.parts || !Array.isArray(candidate.content.parts) || candidate.content.parts.length === 0) {
              console.error("Invalid candidate structure:", candidate);
              
              // Provide more specific error messages based on the structure
              if (candidate && candidate.finishReason) {
                return { success: false, error: `Gemini API response incomplete. Finish reason: ${candidate.finishReason}. Please try again or use a different model.` };
              }
              
              return { success: false, error: "Invalid response structure from Gemini API. The response may be incomplete or malformed." };
            }
            
            const responsePart = candidate.content.parts[0];
            if (!responsePart || !responsePart.text) {
              console.error("Invalid response part:", responsePart);
              return { success: false, error: "No text content in Gemini API response. The response may be empty or incomplete." };
            }
            
            return { success: true, text: responsePart.text };
          }

          const validationResult = validateGeminiResponse(responseData);
          if (!validationResult.success) {
            return {
              success: false,
              error: validationResult.error
            };
          }
          
          debugContent = validationResult.text;
        } catch (error) {
          console.error("Error using Gemini API for debugging:", error);
          return {
            success: false,
            error: "Failed to process debug request with Gemini API. Please check your API key or try again later."
          };
        }
      } else if (config.apiProvider === "openrouter") {
        // OpenRouter processing
        if (!this.openrouterClient) {
          return {
            success: false,
            error: "OpenRouter API key not configured. Please check your settings."
          };
        }

        try {
          const debugPrompt = `
You are a coding interview assistant helping debug and improve solutions. Analyze these screenshots which include either error messages, incorrect outputs, or test cases, and provide detailed debugging help.

I'm solving this coding problem: "${problemInfo.problem_statement}" in ${language}. I need help with debugging or improving my solution.

YOUR RESPONSE MUST FOLLOW THIS EXACT STRUCTURE WITH THESE SECTION HEADERS:
### Issues Identified
- List each issue as a bullet point with clear explanation

### Specific Improvements and Corrections
- List specific code changes needed as bullet points

### Optimizations
- List any performance optimizations if applicable

### Explanation of Changes Needed
Here provide a clear explanation of why the changes are needed

### Key Points
- Summary bullet points of the most important takeaways

If you include code examples, use proper markdown code blocks with language specification.
`;

          const imageMessages = imageDataList.map(data => ({
            type: "image_url" as const,
            image_url: {
              url: `data:image/png;base64,${data}`,
              detail: "high" as const
            }
          }));

          if (mainWindow) {
            mainWindow.webContents.send("processing-status", {
              message: "Analyzing code and generating debug feedback with OpenRouter...",
              progress: 60
            });
          }

          const debugResponse = await this.openrouterClient.chat.completions.create({
            model: config.debuggingModel || config.openrouterModel || "meta-llama/llama-3.1-8b-instruct:free",
            messages: [
              { role: "system", content: "You are an expert coding interview assistant specializing in debugging and code improvement." },
              {
                role: "user",
                content: [
                  { type: "text", text: debugPrompt },
                  ...imageMessages
                ]
              }
            ],
            max_tokens: 16000, // Increased from 8000 to prevent MAX_TOKENS truncation
            temperature: 0.2
          });

          debugContent = debugResponse.choices[0].message.content || "";
        } catch (error) {
          console.error("Error using OpenRouter API for debugging:", error);
          return {
            success: false,
            error: "Failed to process debug request with OpenRouter API. Please check your API key or try again later."
          };
        }
      }
      
      
      if (mainWindow) {
        mainWindow.webContents.send("processing-status", {
          message: "Debug analysis complete",
          progress: 100
        });
      }

      let extractedCode = "// Debug mode - see analysis below";
      const codeMatch = debugContent.match(/```(?:[a-zA-Z]+)?([\s\S]*?)```/);
      if (codeMatch && codeMatch[1]) {
        extractedCode = codeMatch[1].trim();
      }

      let formattedDebugContent = debugContent;
      
      if (!debugContent.includes('# ') && !debugContent.includes('## ')) {
        formattedDebugContent = debugContent
          .replace(/issues identified|problems found|bugs found/i, '## Issues Identified')
          .replace(/code improvements|improvements|suggested changes/i, '## Code Improvements')
          .replace(/optimizations|performance improvements/i, '## Optimizations')
          .replace(/explanation|detailed analysis/i, '## Explanation');
      }

      const bulletPoints = formattedDebugContent.match(/(?:^|\n)[ ]*(?:[-*•]|\d+\.)[ ]+([^\n]+)/g);
      const thoughts = bulletPoints 
        ? bulletPoints.map(point => point.replace(/^[ ]*(?:[-*•]|\d+\.)[ ]+/, '').trim()).slice(0, 5)
        : ["Debug analysis based on your screenshots"];
      
      const response = {
        code: extractedCode,
        debug_analysis: formattedDebugContent,
        thoughts: thoughts,
        time_complexity: "N/A - Debug mode",
        space_complexity: "N/A - Debug mode"
      };

      return { success: true, data: response };
    } catch (error: any) {
      console.error("Debug processing error:", error);
      return { success: false, error: error.message || "Failed to process debug request" };
    }
  }

  private async processMCQScreenshotsHelper(
    screenshots: Array<{ path: string; data: string }>,
    signal: AbortSignal
  ) {
    try {
      const config = configHelper.loadConfig();
      const mainWindow = this.deps.getMainWindow();
      
      // Prepare the images for the API call
      const imageDataList = screenshots.map(screenshot => screenshot.data);
      
      // Update the user on progress
      if (mainWindow) {
        mainWindow.webContents.send("processing-status", {
          message: "Analyzing MCQ question from screenshots...",
          progress: 30
        });
      }

      let mcqResponse;
      
      if (config.apiProvider === "openai") {
        // Verify OpenAI client
        if (!this.openaiClient) {
          this.initializeAIClient(); // Try to reinitialize
          
          if (!this.openaiClient) {
            return {
              success: false,
              error: "OpenAI API key not configured or invalid. Please check your settings."
            };
          }
        }

        // Create the MCQ analysis prompt
        const messages = [
          {
            role: "system" as const, 
            content: "You are an expert at analyzing multiple choice questions from screenshots. Analyze the question and provide the correct answer with detailed reasoning."
          },
          {
            role: "user" as const,
            content: [
              {
                type: "text" as const, 
                text: `Analyze MCQ from screenshots. Return ONLY JSON:
{
  "question": "complete question text",
  "options": ["A. Option 1", "B. Option 2", "C. Option 3", "D. Option 4"],
  "correct_options": ["A"],
  "question_type": "single_correct",
  "reasoning": "brief explanation"
}

question_type: "single_correct", "multiple_correct", or "true_false"
correct_options: array of letters (["A"], ["A","B"], etc.)`
              },
              ...imageDataList.map(data => ({
                type: "image_url" as const,
                image_url: { url: `data:image/png;base64,${data}` }
              }))
            ]
          }
        ];

        // Update progress
        if (mainWindow) {
          mainWindow.webContents.send("processing-status", {
            message: "Processing MCQ with OpenAI...",
            progress: 60
          });
        }

        // Send to OpenAI Vision API
        const response = await this.openaiClient.chat.completions.create({
          model: config.mcqModel || "gpt-4o",
          messages: messages,
          max_tokens: 16000, // Increased further to handle longer MCQ responses
          temperature: 0.1
        });

        // Parse the response
        try {
          const responseText = response.choices[0].message.content;
          if (!responseText) {
            throw new Error("Empty response from OpenAI API");
          }
          
          let jsonText = responseText.replace(/```json|```/g, '').trim();
          
          // Sanitize control characters that can break JSON parsing
          jsonText = this.sanitizeJsonString(jsonText);
          
          mcqResponse = JSON.parse(jsonText);
        } catch (error) {
          console.error("Error parsing OpenAI MCQ response:", error);
          return {
            success: false,
            error: "Failed to parse MCQ analysis. Please try again."
          };
        }
      } else if (config.apiProvider === "gemini") {
        // Use Gemini API
        if (!this.geminiApiKey) {
          return {
            success: false,
            error: "Gemini API key not configured. Please check your settings."
          };
        }

        try {
          // Create Gemini message structure for MCQ
          const geminiMessages: GeminiMessage[] = [
            {
              role: "user",
              parts: [
                {
                  text: `Analyze this MCQ from screenshots. Return ONLY valid JSON:
{
  "question": "complete question text",
  "options": ["A. Option 1", "B. Option 2", "C. Option 3", "D. Option 4"],
  "correct_options": ["A"],
  "question_type": "single_correct",
  "reasoning": "brief explanation"
}

Requirements:
- question_type: "single_correct", "multiple_correct", or "true_false"
- correct_options: array of letters (["A"], ["A","B"], etc.)
- Keep reasoning concise but clear
- No text before/after JSON`
                },
                ...imageDataList.map(data => ({
                  inlineData: {
                    mimeType: "image/png",
                    data: data
                  }
                }))
              ]
            }
          ];

          // Update progress
          if (mainWindow) {
            mainWindow.webContents.send("processing-status", {
              message: "Processing MCQ with Gemini...",
              progress: 60
            });
          }

          // Make API request to Gemini
          const response = await axios.default.post(
            `https://generativelanguage.googleapis.com/v1beta/models/${config.mcqModel || "gemini-2.5-flash"}:generateContent?key=${this.geminiApiKey}`,
            {
              contents: geminiMessages,
              generationConfig: {
                temperature: 0.1,
                maxOutputTokens: 16000 // Increased further to handle longer MCQ responses
              }
            },
            { signal }
          );

          const responseData = response.data as GeminiResponse;
          
          // Helper method to validate Gemini response structure
          const validateGeminiResponse = (responseData: any): { success: boolean; error?: string; text?: string } => {
            if (!responseData) {
              return { success: false, error: "No response data from Gemini API" };
            }
            
            if (!responseData.candidates || !Array.isArray(responseData.candidates) || responseData.candidates.length === 0) {
              console.error("Invalid Gemini response structure:", responseData);
              return { success: false, error: "Empty or invalid candidates array from Gemini API" };
            }
            
            const candidate = responseData.candidates[0];
            
            // Check for MAX_TOKENS or other finish reasons that might affect content structure
            if (candidate && candidate.finishReason === 'MAX_TOKENS') {
              console.error("Gemini API response truncated due to MAX_TOKENS:", candidate);
              return { success: false, error: "Response was truncated due to token limit. Please try with a shorter prompt or increase model's max tokens." };
            }
            
            if (!candidate || !candidate.content || !candidate.content.parts || !Array.isArray(candidate.content.parts) || candidate.content.parts.length === 0) {
              console.error("Invalid candidate structure:", candidate);
              
              // Provide more specific error messages based on the structure
              if (candidate && candidate.finishReason) {
                return { success: false, error: `Gemini API response incomplete. Finish reason: ${candidate.finishReason}. Please try again or use a different model.` };
              }
              
              return { success: false, error: "Invalid response structure from Gemini API. The response may be incomplete or malformed." };
            }
            
            const responsePart = candidate.content.parts[0];
            if (!responsePart || !responsePart.text) {
              console.error("Invalid response part:", responsePart);
              return { success: false, error: "No text content in Gemini API response. The response may be empty or incomplete." };
            }
            
            return { success: true, text: responsePart.text };
          }

          const validationResult = validateGeminiResponse(responseData);
          if (!validationResult.success) {
            return {
              success: false,
              error: validationResult.error
            };
          }
          
          // Parse the Gemini response as JSON
          try {
            let jsonText = validationResult.text.replace(/```json|```/g, '').trim();
            
            // Sanitize control characters that can break JSON parsing
            jsonText = this.sanitizeJsonString(jsonText);
            
            mcqResponse = JSON.parse(jsonText);
          } catch (error) {
            console.error("Error parsing Gemini MCQ response:", error);
            return {
              success: false,
              error: "Failed to parse MCQ analysis from Gemini. Please try again."
            };
          }
        } catch (error) {
          console.error("Error using Gemini API for MCQ:", error);
          return {
            success: false,
            error: "Failed to process MCQ with Gemini API. Please check your API key or try again later."
          };
        }
      } else if (config.apiProvider === "openrouter") {
        // OpenRouter processing using OpenAI-compatible API
        if (!this.openrouterClient) {
          return {
            success: false,
            error: "OpenRouter API key not configured. Please check your settings."
          };
        }

        try {
          const imageMessages = imageDataList.map(data => ({
            type: "image_url" as const,
            image_url: {
              url: `data:image/png;base64,${data}`,
              detail: "high" as const
            }
          }));

          // Update progress
          if (mainWindow) {
            mainWindow.webContents.send("processing-status", {
              message: "Processing MCQ with OpenRouter...",
              progress: 60
            });
          }

          const response = await this.openrouterClient.chat.completions.create({
            model: config.mcqModel || config.openrouterModel || "meta-llama/llama-3.1-8b-instruct:free",
            messages: [
              { 
                role: "system", 
                content: "You are an expert at analyzing multiple choice questions from screenshots. Analyze the question and provide the correct answer with detailed reasoning." 
              },
              {
                role: "user",
                content: [
                  {
                    type: "text",
                    text: `Analyze MCQ from screenshots. Return ONLY JSON:
{
  "question": "complete question text",
  "options": ["A. Option 1", "B. Option 2", "C. Option 3", "D. Option 4"],
  "correct_options": ["A"],
  "question_type": "single_correct",
  "reasoning": "brief explanation"
}

question_type: "single_correct", "multiple_correct", or "true_false"
correct_options: array of letters (["A"], ["A","B"], etc.)`
                  },
                  ...imageMessages
                ]
              }
            ],
            max_tokens: 16000, // Increased further to handle longer MCQ responses
            temperature: 0.1
          });

          const responseContent = response.choices[0].message.content;
          if (!responseContent) {
            throw new Error("Empty response from OpenRouter API");
          }

          let jsonText = responseContent.replace(/```json|```/g, '').trim();
          
          // Sanitize control characters that can break JSON parsing
          jsonText = this.sanitizeJsonString(jsonText);
          
          mcqResponse = JSON.parse(jsonText);
        } catch (error) {
          console.error("Error using OpenRouter API for MCQ:", error);
          return {
            success: false,
            error: "Failed to process MCQ with OpenRouter API. Please check your API key or try again later."
          };
        }
      } else {
        // No valid API provider configured
        return {
          success: false,
          error: "No valid API provider configured. Please check your settings and ensure you have a valid API key."
        };
      }
      
      // Update the user on progress
      if (mainWindow) {
        mainWindow.webContents.send("processing-status", {
          message: "MCQ analysis complete",
          progress: 100
        });
      }

      // Validate mcqResponse exists
      if (!mcqResponse) {
        return {
          success: false,
          error: "Failed to get valid MCQ response from API. Please try again."
        };
      }

      // Format the MCQ response for display
      const formattedResponse = {
        question: mcqResponse.question || "Question extracted from image",
        options: Array.isArray(mcqResponse.options) ? mcqResponse.options : [],
        correct_options: Array.isArray(mcqResponse.correct_options) ? mcqResponse.correct_options : [],
        question_type: mcqResponse.question_type || "single_correct",
        reasoning: mcqResponse.reasoning || "Analysis based on the provided image",
        // For compatibility with existing UI components
        code: `Question: ${mcqResponse.question || 'Question not extracted'}\n\nOptions:\n${(Array.isArray(mcqResponse.options) ? mcqResponse.options : []).map((opt: string, idx: number) => `${opt}`).join('\n')}\n\nCorrect Answer(s): ${(Array.isArray(mcqResponse.correct_options) ? mcqResponse.correct_options : []).join(', ')}\n\nReasoning:\n${mcqResponse.reasoning || 'No reasoning provided'}`,
        thoughts: [
          `Question Type: ${mcqResponse.question_type || 'single_correct'}`, 
          `Correct Answer(s): ${(Array.isArray(mcqResponse.correct_options) ? mcqResponse.correct_options : []).join(', ') || 'Not determined'}`
        ],
        time_complexity: "N/A - MCQ Mode",
        space_complexity: "N/A - MCQ Mode"
      };

      return { success: true, data: formattedResponse };
    } catch (error: any) {
      console.error("MCQ processing error:", error);
      
      // Handle abort signal
      if (axios.isCancel(error)) {
        return {
          success: false,
          error: "MCQ processing was canceled by the user."
        };
      }
      
      return { success: false, error: error.message || "Failed to process MCQ question. Please try again." };
    }
  }

  public cancelOngoingRequests(): void {
    let wasCancelled = false

    if (this.currentProcessingAbortController) {
      this.currentProcessingAbortController.abort()
      this.currentProcessingAbortController = null
      wasCancelled = true
    }

    if (this.currentExtraProcessingAbortController) {
      this.currentExtraProcessingAbortController.abort()
      this.currentExtraProcessingAbortController = null
      wasCancelled = true
    }

    this.deps.setHasDebugged(false)

    this.deps.setProblemInfo(null)

    const mainWindow = this.deps.getMainWindow()
    if (wasCancelled && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(this.deps.PROCESSING_EVENTS.NO_SCREENSHOTS)
    }
  }
}
