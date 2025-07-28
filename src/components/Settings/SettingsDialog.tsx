import { useState, useEffect } from "react";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../ui/dialog";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { Settings } from "lucide-react";
import { useToast } from "../../contexts/toast";

type APIProvider = "openai" | "gemini" | "openrouter";

type AIModel = {
  id: string;
  name: string;
  description: string;
};

type ModelCategory = {
  key: 'extractionModel' | 'solutionModel' | 'debuggingModel' | 'mcqModel';
  title: string;
  description: string;
  openaiModels: AIModel[];
  geminiModels: AIModel[];
  openrouterModels: AIModel[];
};

// Define available models for each category
const modelCategories: ModelCategory[] = [
  {
    key: 'extractionModel',
    title: 'Problem Extraction',
    description: 'Model used to analyze screenshots and extract problem details',
    openaiModels: [
      {
        id: "gpt-4o",
        name: "gpt-4o",
        description: "Best overall performance for problem extraction"
      },
      {
        id: "gpt-4o-mini",
        name: "gpt-4o-mini",
        description: "Faster, more cost-effective option"
      }
    ],
    geminiModels: [
      {
        id: "gemini-2.5-pro",
        name: "Gemini 2.5 Pro",
        description: "Latest and most capable Gemini model"
      },
      {
        id: "gemini-2.5-flash",
        name: "Gemini 2.5 Flash",
        description: "Fast and efficient flash model"
      },
      {
        id: "gemini-2.5-flash-lite-preview-06-17",
        name: "Gemini 2.5 Flash Lite Preview",
        description: "Lightweight preview version for faster responses"
      },
      {
        id: "gemini-2.0-flash",
        name: "Gemini 2.0 Flash",
        description: "Previous generation flash model"
      }
    ],
    openrouterModels: [
      {
        id: "custom",
        name: "Custom Model",
        description: "Use the model specified in OpenRouter settings"
      }
    ]
  },
  {
    key: 'solutionModel',
    title: 'Solution Generation',
    description: 'Model used to generate coding solutions',
    openaiModels: [
      {
        id: "gpt-4o",
        name: "gpt-4o",
        description: "Strong overall performance for coding tasks"
      },
      {
        id: "gpt-4o-mini",
        name: "gpt-4o-mini",
        description: "Faster, more cost-effective option"
      }
    ],
    geminiModels: [
      {
        id: "gemini-2.5-pro",
        name: "Gemini 2.5 Pro",
        description: "Latest and most capable for coding tasks"
      },
      {
        id: "gemini-2.5-flash",
        name: "Gemini 2.5 Flash",
        description: "Fast and efficient for coding solutions"
      },
      {
        id: "gemini-2.5-flash-lite-preview-06-17",
        name: "Gemini 2.5 Flash Lite Preview",
        description: "Lightweight preview for quick coding solutions"
      },
      {
        id: "gemini-2.0-flash",
        name: "Gemini 2.0 Flash",
        description: "Previous generation for coding tasks"
      }
    ],
    openrouterModels: [
      {
        id: "custom",
        name: "Custom Model",
        description: "Use the model specified in OpenRouter settings"
      }
    ]
  },
  {
    key: 'debuggingModel',
    title: 'Debugging',
    description: 'Model used to debug and improve solutions',
    openaiModels: [
      {
        id: "gpt-4o",
        name: "gpt-4o",
        description: "Best for analyzing code and error messages"
      },
      {
        id: "gpt-4o-mini",
        name: "gpt-4o-mini",
        description: "Faster, more cost-effective option"
      }
    ],
    geminiModels: [
      {
        id: "gemini-2.5-pro",
        name: "Gemini 2.5 Pro",
        description: "Best for analyzing code and error messages"
      },
      {
        id: "gemini-2.5-flash",
        name: "Gemini 2.5 Flash",
        description: "Fast debugging and analysis"
      },
      {
        id: "gemini-2.5-flash-lite-preview-06-17",
        name: "Gemini 2.5 Flash Lite Preview",
        description: "Lightweight preview for quick debugging"
      },
      {
        id: "gemini-2.0-flash",
        name: "Gemini 2.0 Flash",
        description: "Previous generation for debugging"
      }
    ],
    openrouterModels: [
      {
        id: "custom",
        name: "Custom Model",
        description: "Use the model specified in OpenRouter settings"
      }
    ]
  },
  {
    key: 'mcqModel',
    title: 'MCQ Analysis',
    description: 'Model used to analyze multiple choice questions and provide answers',
    openaiModels: [
      {
        id: "gpt-4o",
        name: "gpt-4o",
        description: "Best for understanding complex MCQ questions"
      },
      {
        id: "gpt-4o-mini",
        name: "gpt-4o-mini",
        description: "Faster, cost-effective option for MCQ analysis"
      }
    ],
    geminiModels: [
      {
        id: "gemini-2.5-pro",
        name: "Gemini 2.5 Pro",
        description: "Best for complex MCQ reasoning and analysis"
      },
      {
        id: "gemini-2.5-flash",
        name: "Gemini 2.5 Flash",
        description: "Fast and efficient for MCQ questions"
      },
      {
        id: "gemini-2.5-flash-lite-preview-06-17",
        name: "Gemini 2.5 Flash Lite Preview",
        description: "Lightweight preview for quick MCQ analysis"
      },
      {
        id: "gemini-2.0-flash",
        name: "Gemini 2.0 Flash",
        description: "Previous generation for MCQ analysis"
      }
    ],
    openrouterModels: [
      {
        id: "custom",
        name: "Custom Model",
        description: "Use the model specified in OpenRouter settings"
      }
    ]
  }
];

interface SettingsDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function SettingsDialog({ open: externalOpen, onOpenChange }: SettingsDialogProps) {
  const [open, setOpen] = useState(externalOpen || false);
  const [openaiApiKey, setOpenaiApiKey] = useState("");
  const [geminiApiKey, setGeminiApiKey] = useState("");
  const [openrouterApiKey, setOpenrouterApiKey] = useState("");
  const [openrouterModel, setOpenrouterModel] = useState("meta-llama/llama-3.1-8b-instruct:free");
  const [apiProvider, setApiProvider] = useState<APIProvider>("openai");
  const [extractionModel, setExtractionModel] = useState("gpt-4o");
  const [solutionModel, setSolutionModel] = useState("gpt-4o");
  const [debuggingModel, setDebuggingModel] = useState("gpt-4o");
  const [mcqModel, setMcqModel] = useState("gpt-4o");
  const [solvingMode, setSolvingMode] = useState<"coding" | "mcq">("coding");
  const [isLoading, setIsLoading] = useState(false);
  const { showToast } = useToast();

  // Sync with external open state
  useEffect(() => {
    if (externalOpen !== undefined) {
      setOpen(externalOpen);
    }
  }, [externalOpen]);

  // Handle open state changes
  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    // Only call onOpenChange when there's actually a change
    if (onOpenChange && newOpen !== externalOpen) {
      onOpenChange(newOpen);
    }
  };
  
  // Load current config on dialog open
  useEffect(() => {
    if (open) {
      setIsLoading(true);
      interface Config {
        openaiApiKey?: string;
        geminiApiKey?: string;
        openrouterApiKey?: string;
        openrouterModel?: string;
        apiKey?: string; // Legacy support
        apiProvider?: APIProvider;
        extractionModel?: string;
        solutionModel?: string;
        debuggingModel?: string;
        mcqModel?: string;
        solvingMode?: "coding" | "mcq";
      }

      window.electronAPI
        .getConfig()
        .then((config: Config) => {
          const provider = config.apiProvider || "gemini";
          
          setOpenaiApiKey(config.openaiApiKey || config.apiKey || "");
          setGeminiApiKey(config.geminiApiKey || "");
          setOpenrouterApiKey(config.openrouterApiKey || "");
          setOpenrouterModel(config.openrouterModel || "meta-llama/llama-3.1-8b-instruct:free");
          setApiProvider(provider);
          
          // Set model defaults based on provider
          if (provider === "openai") {
            setExtractionModel(config.extractionModel || "gpt-4o");
            setSolutionModel(config.solutionModel || "gpt-4o");
            setDebuggingModel(config.debuggingModel || "gpt-4o");
            setMcqModel(config.mcqModel || "gpt-4o");
          } else if (provider === "openrouter") {
            setExtractionModel(config.extractionModel || "custom");
            setSolutionModel(config.solutionModel || "custom");
            setDebuggingModel(config.debuggingModel || "custom");
            setMcqModel(config.mcqModel || "custom");
          } else {
            // Gemini provider
            setExtractionModel(config.extractionModel || "gemini-2.5-flash");
            setSolutionModel(config.solutionModel || "gemini-2.5-flash");
            setDebuggingModel(config.debuggingModel || "gemini-2.5-flash");
            setMcqModel(config.mcqModel || "gemini-2.5-flash");
          }
          
          setSolvingMode(config.solvingMode || "coding");
        })
        .catch((error: unknown) => {
          console.error("Failed to load config:", error);
          showToast("Error", "Failed to load settings", "error");
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [open, showToast]);

  // Handle API provider change
  const handleProviderChange = (provider: APIProvider) => {
    setApiProvider(provider);
    
    // Reset models to defaults when changing provider
    if (provider === "openai") {
      setExtractionModel("gpt-4o");
      setSolutionModel("gpt-4o");
      setDebuggingModel("gpt-4o");
      setMcqModel("gpt-4o");
    } else if (provider === "gemini") {
      setExtractionModel("gemini-2.5-flash");
      setSolutionModel("gemini-2.5-flash");
      setDebuggingModel("gemini-2.5-flash");
      setMcqModel("gemini-2.5-flash");
    } else if (provider === "openrouter") {
      setExtractionModel("custom");
      setSolutionModel("custom");
      setDebuggingModel("custom");
      setMcqModel("custom");
    }
  };

  const handleSave = async () => {
    setIsLoading(true);
    try {
      const result = await window.electronAPI.updateConfig({
        openaiApiKey,
        geminiApiKey,
        openrouterApiKey,
        openrouterModel,
        apiProvider,
        extractionModel,
        solutionModel,
        debuggingModel,
        mcqModel,
        solvingMode,
      });
      
      if (result) {
        showToast("Success", "Settings saved successfully", "success");
        handleOpenChange(false);
        
        // Force reload the app to apply the API key
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      }
    } catch (error) {
      console.error("Failed to save settings:", error);
      showToast("Error", "Failed to save settings", "error");
    } finally {
      setIsLoading(false);
    }
  };

  // Mask API key for display
  const maskApiKey = (key: string) => {
    if (!key || key.length < 10) return "";
    return `${key.substring(0, 4)}...${key.substring(key.length - 4)}`;
  };

  // Open external link handler
  const openExternalLink = (url: string) => {
    window.electronAPI.openLink(url);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent 
        className="sm:max-w-md bg-black border border-white/10 text-white settings-dialog"
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 'min(450px, 90vw)',
          height: 'auto',
          minHeight: '400px',
          maxHeight: '90vh',
          overflowY: 'auto',
          zIndex: 9999,
          margin: 0,
          padding: '20px',
          transition: 'opacity 0.25s ease, transform 0.25s ease',
          animation: 'fadeIn 0.25s ease forwards',
          opacity: 0.98
        }}
      >        
        <DialogHeader>
          <DialogTitle>API Settings</DialogTitle>
          <DialogDescription className="text-white/70">
            Configure your API key and model preferences. You'll need your own API key to use this application.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {/* API Provider Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-white">API Provider</label>
            <div className="flex gap-2">
              <div
                className={`flex-1 p-2 rounded-lg cursor-pointer transition-colors ${
                  apiProvider === "openai"
                    ? "bg-white/10 border border-white/20"
                    : "bg-black/30 border border-white/5 hover:bg-white/5"
                }`}
                onClick={() => handleProviderChange("openai")}
              >
                <div className="flex items-center gap-2">
                  <div
                    className={`w-3 h-3 rounded-full ${
                      apiProvider === "openai" ? "bg-white" : "bg-white/20"
                    }`}
                  />
                  <div className="flex flex-col">
                    <p className="font-medium text-white text-sm">OpenAI</p>
                    <p className="text-xs text-white/60">GPT-4o models</p>
                  </div>
                </div>
              </div>
              <div
                className={`flex-1 p-2 rounded-lg cursor-pointer transition-colors ${
                  apiProvider === "gemini"
                    ? "bg-white/10 border border-white/20"
                    : "bg-black/30 border border-white/5 hover:bg-white/5"
                }`}
                onClick={() => handleProviderChange("gemini")}
              >
                <div className="flex items-center gap-2">
                  <div
                    className={`w-3 h-3 rounded-full ${
                      apiProvider === "gemini" ? "bg-white" : "bg-white/20"
                    }`}
                  />
                  <div className="flex flex-col">
                    <p className="font-medium text-white text-sm">Gemini</p>
                    <p className="text-xs text-white/60">Gemini 2.5 & 1.5 models</p>
                  </div>
                </div>
              </div>
              <div
                className={`flex-1 p-2 rounded-lg cursor-pointer transition-colors ${
                  apiProvider === "openrouter"
                    ? "bg-white/10 border border-white/20"
                    : "bg-black/30 border border-white/5 hover:bg-white/5"
                }`}
                onClick={() => handleProviderChange("openrouter")}
              >
                <div className="flex items-center gap-2">
                  <div
                    className={`w-3 h-3 rounded-full ${
                      apiProvider === "openrouter" ? "bg-white" : "bg-white/20"
                    }`}
                  />
                  <div className="flex flex-col">
                    <p className="font-medium text-white text-sm">OpenRouter</p>
                    <p className="text-xs text-white/60">Access multiple models</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Solving Mode Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-white">Solving Mode</label>
            <div className="flex gap-2">
              <div
                className={`flex-1 p-2 rounded-lg cursor-pointer transition-colors ${
                  solvingMode === "coding"
                    ? "bg-white/10 border border-white/20"
                    : "bg-black/30 border border-white/5 hover:bg-white/5"
                }`}
                onClick={() => setSolvingMode("coding")}
              >
                <div className="flex items-center gap-2">
                  <div
                    className={`w-3 h-3 rounded-full ${
                      solvingMode === "coding" ? "bg-white" : "bg-white/20"
                    }`}
                  />
                  <div className="flex flex-col">
                    <p className="font-medium text-white text-sm">Coding Questions</p>
                    <p className="text-xs text-white/60">2-step process: extract + solve</p>
                  </div>
                </div>
              </div>
              <div
                className={`flex-1 p-2 rounded-lg cursor-pointer transition-colors ${
                  solvingMode === "mcq"
                    ? "bg-white/10 border border-white/20"
                    : "bg-black/30 border border-white/5 hover:bg-white/5"
                }`}
                onClick={() => setSolvingMode("mcq")}
              >
                <div className="flex items-center gap-2">
                  <div
                    className={`w-3 h-3 rounded-full ${
                      solvingMode === "mcq" ? "bg-white" : "bg-white/20"
                    }`}
                  />
                  <div className="flex flex-col">
                    <p className="font-medium text-white text-sm">MCQ Questions</p>
                    <p className="text-xs text-white/60">Direct: image → answer + reason</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* API Key Configuration */}
          <div className="space-y-4">
            {apiProvider === "openai" && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-white" htmlFor="openaiApiKey">
                  OpenAI API Key
                </label>
                <Input
                  id="openaiApiKey"
                  type="password"
                  value={openaiApiKey}
                  onChange={(e) => setOpenaiApiKey(e.target.value)}
                  placeholder="sk-..."
                  className="bg-black/50 border-white/10 text-white"
                />
                {openaiApiKey && (
                  <p className="text-xs text-white/50">
                    Current: {maskApiKey(openaiApiKey)}
                  </p>
                )}
                <div className="mt-2 p-2 rounded-md bg-white/5 border border-white/10">
                  <p className="text-xs text-white/80 mb-1">Don't have an API key?</p>
                  <p className="text-xs text-white/60 mb-1">1. Create an account at <button 
                    onClick={() => openExternalLink('https://platform.openai.com/signup')} 
                    className="text-blue-400 hover:underline cursor-pointer">OpenAI</button>
                  </p>
                  <p className="text-xs text-white/60 mb-1">2. Go to <button 
                    onClick={() => openExternalLink('https://platform.openai.com/api-keys')} 
                    className="text-blue-400 hover:underline cursor-pointer">API Keys</button> section
                  </p>
                  <p className="text-xs text-white/60">3. Create a new secret key and paste it here</p>
                </div>
              </div>
            )}

            {apiProvider === "gemini" && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-white" htmlFor="geminiApiKey">
                  Gemini API Key
                </label>
                <Input
                  id="geminiApiKey"
                  type="password"
                  value={geminiApiKey}
                  onChange={(e) => setGeminiApiKey(e.target.value)}
                  placeholder="Enter your Gemini API key"
                  className="bg-black/50 border-white/10 text-white"
                />
                {geminiApiKey && (
                  <p className="text-xs text-white/50">
                    Current: {maskApiKey(geminiApiKey)}
                  </p>
                )}
                <div className="mt-2 p-2 rounded-md bg-white/5 border border-white/10">
                  <p className="text-xs text-white/80 mb-1">Don't have an API key?</p>
                  <p className="text-xs text-white/60 mb-1">1. Create an account at <button 
                    onClick={() => openExternalLink('https://aistudio.google.com/')} 
                    className="text-blue-400 hover:underline cursor-pointer">Google AI Studio</button>
                  </p>
                  <p className="text-xs text-white/60 mb-1">2. Go to the <button 
                    onClick={() => openExternalLink('https://aistudio.google.com/app/apikey')} 
                    className="text-blue-400 hover:underline cursor-pointer">API Keys</button> section
                  </p>
                  <p className="text-xs text-white/60">3. Create a new API key and paste it here</p>
                </div>
              </div>
            )}

            {apiProvider === "openrouter" && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-white" htmlFor="openrouterApiKey">
                  OpenRouter API Key
                </label>
                <Input
                  id="openrouterApiKey"
                  type="password"
                  value={openrouterApiKey}
                  onChange={(e) => setOpenrouterApiKey(e.target.value)}
                  placeholder="sk-or-..."
                  className="bg-black/50 border-white/10 text-white"
                />
                {openrouterApiKey && (
                  <p className="text-xs text-white/50">
                    Current: {maskApiKey(openrouterApiKey)}
                  </p>
                )}
                
                <label className="text-sm font-medium text-white" htmlFor="openrouterModel">
                  OpenRouter Model
                </label>
                <Input
                  id="openrouterModel"
                  type="text"
                  value={openrouterModel}
                  onChange={(e) => setOpenrouterModel(e.target.value)}
                  placeholder="meta-llama/llama-3.1-8b-instruct:free"
                  className="bg-black/50 border-white/10 text-white"
                />
                <p className="text-xs text-white/50">
                  Specify the model to use (e.g., gpt-4, meta-llama/llama-3.1-8b-instruct:free, anthropic/claude-3-sonnet)
                </p>
                
                <div className="mt-2 p-2 rounded-md bg-white/5 border border-white/10">
                  <p className="text-xs text-white/80 mb-1">Don't have an API key?</p>
                  <p className="text-xs text-white/60 mb-1">1. Create an account at <button 
                    onClick={() => openExternalLink('https://openrouter.ai')} 
                    className="text-blue-400 hover:underline cursor-pointer">OpenRouter</button>
                  </p>
                  <p className="text-xs text-white/60 mb-1">2. Go to the <button 
                    onClick={() => openExternalLink('https://openrouter.ai/keys')} 
                    className="text-blue-400 hover:underline cursor-pointer">API Keys</button> section
                  </p>
                  <p className="text-xs text-white/60">3. Create a new API key and paste it here</p>
                </div>
              </div>
            )}
          </div>
          
          <div className="space-y-2 mt-4">
            <label className="text-sm font-medium text-white mb-2 block">Keyboard Shortcuts</label>
            <div className="bg-black/30 border border-white/10 rounded-lg p-3">
              <div className="grid grid-cols-2 gap-y-2 text-xs">
                <div className="text-white/70">Toggle Visibility</div>
                <div className="text-white/90 font-mono">Ctrl+B / Cmd+B</div>
                
                <div className="text-white/70">Take Screenshot</div>
                <div className="text-white/90 font-mono">Ctrl+H / Cmd+H</div>
                
                <div className="text-white/70">Process Screenshots</div>
                <div className="text-white/90 font-mono">Ctrl+Enter / Cmd+Enter</div>
                
                <div className="text-white/70">Delete Last Screenshot</div>
                <div className="text-white/90 font-mono">Ctrl+L / Cmd+L</div>
                
                <div className="text-white/70">Reset View</div>
                <div className="text-white/90 font-mono">Ctrl+R / Cmd+R</div>
                
                <div className="text-white/70">Quit Application</div>
                <div className="text-white/90 font-mono">Ctrl+Q / Cmd+Q</div>
                
                <div className="text-white/70">Move Window</div>
                <div className="text-white/90 font-mono">Ctrl+Arrow Keys</div>
                
                <div className="text-white/70">Decrease Opacity</div>
                <div className="text-white/90 font-mono">Ctrl+[ / Cmd+[</div>
                
                <div className="text-white/70">Increase Opacity</div>
                <div className="text-white/90 font-mono">Ctrl+] / Cmd+]</div>
                
                <div className="text-white/70">Zoom Out</div>
                <div className="text-white/90 font-mono">Ctrl+- / Cmd+-</div>
                
                <div className="text-white/70">Reset Zoom</div>
                <div className="text-white/90 font-mono">Ctrl+0 / Cmd+0</div>
                
                <div className="text-white/70">Zoom In</div>
                <div className="text-white/90 font-mono">Ctrl+= / Cmd+=</div>
              </div>
            </div>
          </div>
          
          {/* AI Model Selection - Show for both coding and MCQ modes */}
          <div className="space-y-4 mt-4">
            <label className="text-sm font-medium text-white">AI Model Selection</label>
            <p className="text-xs text-white/60 -mt-3 mb-2">
              {solvingMode === "coding" 
                ? "Select which models to use for each stage of the process"
                : "Select which model to use for MCQ analysis"
              }
            </p>
          
          {solvingMode === "coding" ? (
            // Coding mode - show all models except MCQ
            modelCategories.filter(category => category.key !== 'mcqModel').map((category) => {
              // Get the appropriate model list based on selected provider
              const models = 
                apiProvider === "openai" ? category.openaiModels : 
                apiProvider === "gemini" ? category.geminiModels :
                category.openrouterModels;
              
              return (
                <div key={category.key} className="mb-4">
                  <label className="text-sm font-medium text-white mb-1 block">
                    {category.title}
                  </label>
                  <p className="text-xs text-white/60 mb-2">{category.description}</p>
                  
                  <div className="space-y-2">
                    {models.map((m) => {
                      // Determine which state to use based on category key
                      const currentValue = 
                        category.key === 'extractionModel' ? extractionModel :
                        category.key === 'solutionModel' ? solutionModel :
                        debuggingModel;
                      
                      // Determine which setter function to use
                      const setValue = 
                        category.key === 'extractionModel' ? setExtractionModel :
                        category.key === 'solutionModel' ? setSolutionModel :
                        setDebuggingModel;
                        
                      return (
                        <div
                          key={m.id}
                          className={`p-2 rounded-lg cursor-pointer transition-colors ${
                            currentValue === m.id
                              ? "bg-white/10 border border-white/20"
                              : "bg-black/30 border border-white/5 hover:bg-white/5"
                          }`}
                          onClick={() => setValue(m.id)}
                        >
                          <div className="flex items-center gap-2">
                            <div
                              className={`w-3 h-3 rounded-full ${
                                currentValue === m.id ? "bg-white" : "bg-white/20"
                              }`}
                            />
                            <div>
                              <p className="font-medium text-white text-xs">{m.name}</p>
                              <p className="text-xs text-white/60">{m.description}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          ) : (
            // MCQ mode - show only MCQ model
            (() => {
              const mcqCategory = modelCategories.find(category => category.key === 'mcqModel');
              if (!mcqCategory) return null;
              
              const models = 
                apiProvider === "openai" ? mcqCategory.openaiModels : 
                apiProvider === "gemini" ? mcqCategory.geminiModels :
                mcqCategory.openrouterModels;
              
              return (
                <div className="mb-4">
                  <label className="text-sm font-medium text-white mb-1 block">
                    {mcqCategory.title}
                  </label>
                  <p className="text-xs text-white/60 mb-2">{mcqCategory.description}</p>
                  
                  <div className="space-y-2">
                    {models.map((m) => (
                      <div
                        key={m.id}
                        className={`p-2 rounded-lg cursor-pointer transition-colors ${
                          mcqModel === m.id
                            ? "bg-white/10 border border-white/20"
                            : "bg-black/30 border border-white/5 hover:bg-white/5"
                        }`}
                        onClick={() => setMcqModel(m.id)}
                      >
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-3 h-3 rounded-full ${
                              mcqModel === m.id ? "bg-white" : "bg-white/20"
                            }`}
                          />
                          <div>
                            <p className="font-medium text-white text-xs">{m.name}</p>
                            <p className="text-xs text-white/60">{m.description}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()
          )}
        </div>
        </div>
        <DialogFooter className="flex justify-between sm:justify-between">
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            className="border-white/10 hover:bg-white/5 text-white"
          >
            Cancel
          </Button>
          <Button
            className="px-4 py-3 bg-white text-black rounded-xl font-medium hover:bg-white/90 transition-colors"
            onClick={handleSave}
            disabled={isLoading || (
              apiProvider === "openai" && !openaiApiKey ||
              apiProvider === "gemini" && !geminiApiKey ||
              apiProvider === "openrouter" && !openrouterApiKey
            )}
          >
            {isLoading ? "Saving..." : "Save Settings"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
