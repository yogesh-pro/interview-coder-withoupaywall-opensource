# CodeInterviewAssist

> ## ⚠️ IMPORTANT NOTICE TO THE COMMUNITY ⚠️
> 
> **This is a free, open-source initiative - NOT a full-service product!**
> 
> There are numerous paid interview preparation tools charging hundreds of dollars for comprehensive features like live audio capture, automated answer generation, and more. This project is fundamentally different:
> 
> - This is a **small, non-profit, community-driven project** with zero financial incentive behind it
> - The entire codebase is freely available for anyone to use, modify, or extend
> - Want features like voice support? You're welcome to integrate tools like OpenAI's Whisper or other APIs
> - New features should come through **community contributions** - it's unreasonable to expect a single maintainer to implement premium features for free
> - The maintainer receives no portfolio benefit, monetary compensation, or recognition for this work
> 
> **Before submitting feature requests or expecting personalized support, please understand this project exists purely as a community resource.** If you value what's been created, the best way to show appreciation is by contributing code, documentation, or helping other users.

> ## 🔑 API KEY INFORMATION - UPDATED
>
> We support **OpenAI, Gemini, and OpenRouter APIs** with the current version. Each service now uses a unique API key for better organization and security:
>
> - **OpenAI**: Use your OpenAI API key for GPT-4o models
> - **Gemini**: Use your Google AI Studio API key for Gemini 2.0 Flash and Gemini 2.5 Pro models  
> - **OpenRouter**: Use your OpenRouter API key to access multiple models from different providers
>
> If you are experiencing issues with your API keys:
>
> - Try deleting your API key entry from the config file located in your user data directory
> - Log out and log back in to the application
> - Check your API key dashboard to verify the key is active and has sufficient credits
> - Ensure you're using the correct API key format (OpenAI keys start with "sk-", OpenRouter keys start with "sk-or-")
>
> The configuration file is stored at: `C:\Users\[USERNAME]\AppData\Roaming\interview-coder-v1\config.json` (on Windows) or `/Users/[USERNAME]/Library/Application Support/interview-coder-v1/config.json` (on macOS)

## Free, Open-Source AI-Powered Interview Preparation Tool

This project provides a powerful alternative to premium coding interview platforms. It delivers the core functionality of paid interview preparation tools but in a free, open-source package. Using your own OpenAI API key, you get access to advanced features like AI-powered problem analysis, solution generation, and debugging assistance - all running locally on your machine.

### Why This Exists

The best coding interview tools are often behind expensive paywalls, making them inaccessible to many students and job seekers. This project provides the same powerful functionality without the cost barrier, letting you:

- Use your own API key (pay only for what you use)
- Run everything locally on your machine with complete privacy
- Make customizations to suit your specific needs
- Learn from and contribute to an open-source tool

### Customization Possibilities

The codebase is designed to be adaptable:

- **AI Models**: Supports OpenAI, Google Gemini, and OpenRouter APIs. You can modify the code to integrate with other providers by updating the API calls in `electron/ProcessingHelper.ts` and UI settings in `src/components/Settings/SettingsDialog.tsx`.
- **Languages**: Add support for additional programming languages
- **Features**: Extend the functionality with new capabilities 
- **UI**: Customize the interface to your preferences

All it takes is modest JavaScript/TypeScript knowledge and understanding of the API you want to integrate.

## Features

- 🎯 99% Invisibility: Undetectable window that bypasses most screen capture methods
- 📸 Smart Screenshot Capture: Capture both question text and code separately for better analysis
- 🤖 AI-Powered Analysis: Automatically extracts and analyzes problems using multiple AI providers (OpenAI, Gemini, OpenRouter)
- 💡 Dual Processing Modes:
  - **Coding Questions**: 2-step process with detailed solutions, complexity analysis, and debugging
  - **MCQ Questions**: Direct analysis with immediate answers and reasoning for multiple choice questions
- 🔧 Real-time Debugging: Debug your code with AI assistance and structured feedback
- 🎨 Advanced Window Management: Freely move, resize, change opacity, and zoom the window
- 🔄 Multi-Provider Support: Choose between OpenAI, Gemini, and OpenRouter with model selection
- 📝 MCQ Question Types: Supports single correct, multiple correct, and true/false questions
- 🔒 Privacy-Focused: Your API key and data never leave your computer except for API calls

## Global Commands

The application uses unidentifiable global keyboard shortcuts that won't be detected by browsers or other applications:

- Toggle Window Visibility: [Control or Cmd + B]
- Move Window: [Control or Cmd + Arrow keys]
- Take Screenshot: [Control or Cmd + H]
- Delete Last Screenshot: [Control or Cmd + L]
- Process Screenshots: [Control or Cmd + Enter]
- Start New Problem: [Control or Cmd + R]
- Quit: [Control or Cmd + Q]
- Decrease Opacity: [Control or Cmd + []
- Increase Opacity: [Control or Cmd + ]]
- Zoom Out: [Control or Cmd + -]
- Reset Zoom: [Control or Cmd + 0]
- Zoom In: [Control or Cmd + =]

## Invisibility Compatibility

The application is invisible to:

- Zoom versions below 6.1.6 (inclusive)
- All browser-based screen recording software
- All versions of Discord
- Mac OS _screenshot_ functionality (Command + Shift + 3/4)

Note: The application is **NOT** invisible to:

- Zoom versions 6.1.6 and above
  - https://zoom.en.uptodown.com/mac/versions (link to downgrade Zoom if needed)
- Mac OS native screen _recording_ (Command + Shift + 5)

## Prerequisites

- Node.js (v16 or higher)
- npm or bun package manager
- API Key from one of the supported providers:
  - **OpenAI API Key** (for GPT-4o models)
  - **Gemini API Key** (for Gemini 2.0 Flash and 2.5 Pro models)
  - **OpenRouter API Key** (for access to multiple model providers)
- Screen Recording Permission for Terminal/IDE
  - On macOS:
    1. Go to System Preferences > Security & Privacy > Privacy > Screen Recording
    2. Ensure that CodeInterviewAssist has screen recording permission enabled
    3. Restart CodeInterviewAssist after enabling permissions
  - On Windows:
    - No additional permissions needed
  - On Linux:
    - May require `xhost` access depending on your distribution

## Running the Application

### Quick Start

1. Clone the repository:

```bash
git clone https://github.com/greeneu/interview-coder-withoupaywall-opensource.git
cd interview-coder-withoupaywall-opensource
```

2. Install dependencies:

```bash
npm install
```

3. **RECOMMENDED**: Clean any previous builds:

```bash
npm run clean
```

4. Run the appropriate script for your platform:

**For Windows:**
```bash
stealth-run.bat
```

**For macOS/Linux:**
```bash
# Make the script executable first
chmod +x stealth-run.sh
./stealth-run.sh
```

**IMPORTANT**: The application window will be invisible by default! Use Ctrl+B (or Cmd+B on Mac) to toggle visibility.

### Building Distributable Packages

To create installable packages for distribution:

**For macOS (DMG):**
```bash
# Using npm
npm run package-mac

# Or using yarn
yarn package-mac
```

**For Windows (Installer):**
```bash
# Using npm
npm run package-win

# Or using yarn
yarn package-win
```

The packaged applications will be available in the `release` directory.

**What the scripts do:**
- Create necessary directories for the application
- Clean previous builds to ensure a fresh start
- Build the application in production mode
- Launch the application in invisible mode

### Notes & Troubleshooting

- **Window Manager Compatibility**: Some window management tools (like Rectangle Pro on macOS) may interfere with the app's window movement. Consider disabling them temporarily.

- **API Usage**: Be mindful of your OpenAI API key's rate limits and credit usage. Vision API calls are more expensive than text-only calls.

- **LLM Customization**: You can easily customize the app to include additional LLMs by modifying the API calls in `ProcessingHelper.ts` and related UI components. OpenRouter integration provides access to multiple models.

- **Common Issues**:
  - Run `npm run clean` before starting the app for a fresh build
  - Use Ctrl+B/Cmd+B multiple times if the window doesn't appear
  - Adjust window opacity with Ctrl+[/]/Cmd+[/] if needed
  - For macOS: ensure script has execute permissions (`chmod +x stealth-run.sh`)

## Comparison with Paid Interview Tools

| Feature | Premium Tools (Paid) | CodeInterviewAssist (This Project) |
|---------|------------------------|----------------------------------------|
| Price | $60/month subscription | Free (only pay for your API usage) |
| Solution Generation | ✅ | ✅ |
| Debugging Assistance | ✅ | ✅ |
| Invisibility | ✅ | ✅ |
| Multi-language Support | ✅ | ✅ |
| Time/Space Complexity Analysis | ✅ | ✅ |
| Window Management | ✅ | ✅ |
| Auth System | Required | None (Simplified) |
| Payment Processing | Required | None (Use your own API key) |
| Privacy | Server-processed | 100% Local Processing |
| Customization | Limited | Full Source Code Access |
| Model Selection | Limited | Choice Between Models |

## Tech Stack

- Electron
- React
- TypeScript
- Vite
- Tailwind CSS
- Radix UI Components
- OpenAI API

## How It Works

1. **Initial Setup**
   - Launch the invisible window
   - Enter your API key in the settings (OpenAI, Gemini, or OpenRouter)
   - Choose your preferred AI provider and models
   - Select your solving mode (Coding Questions or MCQ Questions)

2. **Solving Mode Selection**
   - **Coding Questions Mode**: Traditional 2-step process (extract problem → generate solution)
     - Best for LeetCode-style algorithm problems
     - Provides detailed code solutions with complexity analysis
   - **MCQ Questions Mode**: Direct analysis (screenshot → answer + reasoning)
     - Perfect for multiple choice questions, true/false questions
     - Supports single correct, multiple correct, and true/false question types
     - Provides immediate answers with detailed explanations

3. **Capturing Problem**
   - Use global shortcut [Control or Cmd + H] to take screenshots of questions
   - Screenshots are automatically added to the queue
   - If needed, remove the last screenshot with [Control or Cmd + L]

4. **Processing**
   - Press [Control or Cmd + Enter] to analyze the screenshots
   - **For Coding Questions**: AI extracts problem requirements and generates optimized solutions
   - **For MCQ Questions**: AI analyzes the question and provides direct answers with reasoning
   - All analysis is done using your personal API key

5. **Results & Debugging**
   - **Coding Mode**: View solutions with code, complexity analysis, and detailed explanations
   - **MCQ Mode**: See the complete question, all options, correct answers, and reasoning
   - Use debugging feature by taking more screenshots of error messages or additional context
   - Get structured analysis with identified issues, corrections, and optimizations

6. **Window Management**
   - Move window using [Control or Cmd + Arrow keys]
   - Toggle visibility with [Control or Cmd + B]
   - Adjust opacity with [Control or Cmd + [] and [Control or Cmd + ]]
   - Window remains invisible to specified screen sharing applications
   - Start a new problem using [Control or Cmd + R]

7. **Language Selection**
   - Easily switch between programming languages with a single click (Coding mode only)
   - Use arrow keys for keyboard navigation through available languages
   - The system dynamically adapts to any languages added or removed from the codebase
   - Your language preference is saved between sessions

## Adding More AI Models

This application is built with extensibility in mind. You can easily add support for additional LLMs alongside the existing OpenAI integration:

- You can add additional AI model providers as alternative options through OpenRouter or direct API integration
- The application architecture allows for multiple LLM backends to coexist
- Users can have the freedom to choose their preferred AI provider

To add new models, simply extend the API integration in `electron/ProcessingHelper.ts` and add the corresponding UI options in `src/components/Settings/SettingsDialog.tsx`. The modular design makes this straightforward without disrupting existing functionality.

## Configuration

- **OpenAI API Key**: Your personal API key is stored locally and only used for API calls to OpenAI
- **Model Selection**: You can choose between GPT-4o and GPT-4o-mini for each stage of processing:
  - Problem Extraction: Analyzes screenshots to understand the coding problem
  - Solution Generation: Creates optimized solutions with explanations
  - Debugging: Provides detailed analysis of errors and improvement suggestions
- **Language**: Select your preferred programming language for solutions
- **Window Controls**: Adjust opacity, position, and zoom level using keyboard shortcuts
- **All settings are stored locally** in your user data directory and persist between sessions

## License

This project is licensed under the GNU Affero General Public License v3.0 (AGPL-3.0).

### What This Means

- You are free to use, modify, and distribute this software
- If you modify the code, you must make your changes available under the same license
- If you run a modified version on a network server, you must make the source code available to users
- We strongly encourage you to contribute improvements back to the main project

See the [LICENSE-SHORT](LICENSE-SHORT) file for a summary of terms or visit [GNU AGPL-3.0](https://www.gnu.org/licenses/agpl-3.0.html) for the full license text.

### Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for more information.

## Disclaimer and Ethical Usage

This tool is intended as a learning aid and practice assistant. While it can help you understand problems and solution approaches during interviews, consider these ethical guidelines:

- Be honest about using assistance tools if asked directly in an interview
- Use this tool to learn concepts, not just to get answers
- Recognize that understanding solutions is more valuable than simply presenting them
- In take-home assignments, make sure you thoroughly understand any solutions you submit

Remember that the purpose of technical interviews is to assess your problem-solving skills and understanding. This tool works best when used to enhance your learning, not as a substitute for it.

## Support and Questions

If you have questions or need support, please open an issue on the GitHub repository.

---

> **Remember:** This is a community resource. If you find it valuable, consider contributing rather than just requesting features. The project grows through collective effort, not individual demands.
