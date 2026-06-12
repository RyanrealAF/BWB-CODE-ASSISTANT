# BWB Code Assistant

**Build While Bleeding — A versatile and powerful code assistant REPL**

This project is an interactive code assistant that runs in a REPL (Read-Eval-Print Loop) environment. It's designed to be a powerful and flexible tool for developers, providing assistance with a wide range of coding tasks.

## Key Features

*   **Interactive REPL:** The assistant is accessed through a command-line REPL, allowing for a conversational and interactive coding experience.
*   **Multi-Modal AI Support:** The assistant can be configured to use different AI models, including:
    *   **Claude:** For powerful and creative code generation.
    *   **Gemini:** For fast and efficient code completion and suggestions.
    *   **Groq:** For high-performance and low-latency responses.
*   **Job-Based Architecture:** The project is evolving to support a job-based architecture using Firebase and Ollama. This will allow for offline or on-device processing of AI tasks, making the assistant more resilient and versatile.
*   **Extensible Command System:** The REPL includes a command system that can be extended with new features and integrations.

## Getting Started

1.  **Install Dependencies:** Run `npm install` to install the required dependencies.
2.  **Configure API Keys:** Create a `.env` file and add your API keys for the AI models you want to use.
3.  **Run the Assistant:** Run `npm start` to start the REPL.

## Commands

The REPL includes a set of commands for interacting with the assistant and the project. Type `:help` in the REPL to see a list of available commands.
