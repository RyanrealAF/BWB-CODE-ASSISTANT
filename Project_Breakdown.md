# BWB Code Assistant & Urban Myth Engine: Full Breakdown

## 1. Overview

This project is an interactive, context-aware code assistant that runs in a REPL (Read-Eval-Print Loop) environment. It is designed for a Termux + Node.js environment, making it a powerful and portable tool for developers. The assistant leverages the Groq API for fast AI inference, using Llama 3.1 models for its core logic and creative text generation.

The system includes an integrated **Urban Myth Engine**, a creative text generation tool that can be used to generate stories and other creative content.

The architecture is designed to be persistent and extensible, with features for file system interaction, Python script execution, and long-term memory persistence via Cloudflare Workers KV and D1.

## 2. Core Architecture

*   **REPL Interface:** The primary user interface is a command-line REPL, providing a conversational loop for coding assistance.
*   **File System Context:** Users can load files into the assistant's context, allowing it to reason about and modify the current codebase.
*   **Python Execution:** The assistant can execute Python scripts and receive the output, enabling runtime validation and tool use.
*   **AI Models (Groq API):**
    *   **Narrative Model (llama-3.1-8b-instant):** Used for generating the base narrative and for most code-related tasks.
    *   **Distortion Model (llama-3.1-70b-versatile):** Used to inject surreal, unexpected details into the narrative.
*   **Long-Term Memory:** The assistant uses Cloudflare Workers KV and D1 for long-term memory persistence, allowing it to retain context across sessions.

## 3. Commands

The REPL includes a rich set of commands:

### General Commands

*   `:help`: Show the list of available commands.
*   `:load <file>`: Inject a file into the context.
*   `:scan [dir] [.ext]`: List files in the project.
*   `:context`: Show loaded files.
*   `:clear`: Drop the file context, but keep the history.
*   `:reset`: Wipe files and history (local).
*   `:save [file]`: Save the last code block to a file.
*   `:run <file.py>`: Execute a Python script and inject the output into the next message.
*   `:write <file> [lang]`: Extract the last code block and write it to a file.
*   `:notes [tag]`: Show memory notes (optional tag filter).
*   `:flush`: Manual flush to Cloudflare.
*   `:dir [path]`: Change the working directory.
*   `:pwd`: Print the working directory.
*   `:project [name]`: Show or set the project name.
*   `:exit` / `:quit`: Exit the REPL.

### File System Commands (`:fs`)

*   `:fs read <file>`: Read a file with line numbers.
*   `:fs write <file>`: Write the last code block to a file.
*   `:fs edit <file> <old>|||<new>`: Surgical string replace in a file.
*   `:fs diff <file>`: Diff the current file vs. the loaded version.
*   `:fs batch <dir> [.ext .ext]`: Load all matching files in a directory.
*   `:fs tree [dir]`: Visual directory tree.

### Urban Myth Engine (`:myth`)

*   `:myth "seed"`: Generate a new myth from a seed phrase.
*   `:myth archetypes`: List all stored archetypes.
*   `:myth history <name>`: View the mutation history of an archetype.
*   `:myth reset`: Erase the archetype database.

## 4. Deployment and Environment

*   **Runtime:** Android Termux + Node.js
*   **Nix Environment:** The project uses a `dev.nix` file to define the development environment, including the Node.js version and other packages.

## 5. Dependencies

The project uses the following dependencies:

*   `@anthropic-ai/sdk`
*   `@google/genai`
*   `dotenv`
*   `groq-sdk`
*   `sql.js`
