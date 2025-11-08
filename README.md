# Terminal AI Assistant (T-AI)

<div align="center">

```
           ⚡                                                    ⚡
         ▄▄▄                                                  ▄▄▄
       ▄█████▄                                              ▄█████▄
      ███████████                                        ███████████
     █████████████                                      █████████████

          ████████╗        █████╗        ██╗
          ╚══██╔══╝       ██╔══██╗       ██║
             ██║          ███████║       ██║
             ██║          ██╔══██║       ██║
             ██║          ██║  ██║       ██║
             ╚═╝          ╚═╝  ╚═╝       ╚═╝

                    YOUR AI-POWERED TERMINAL ASSISTANT
```


**Transform natural language into powerful terminal commands with AI**

[Features](#-features) • [Installation](#-installation) • [Usage](#-usage) • [Examples](#-examples) • [Documentation](#-documentation)

</div>

---

## 🌟 Overview

T-AI (Terminal AI Assistant) is a cutting-edge CLI tool that bridges the gap between human language and terminal commands. Powered by MiniMax M2 AI, it understands your intent and generates precise, executable commands while keeping your workflow secure and efficient.

### Why T-AI?
-Because you don't remember the command 🥲

---

## ✨ Features

### 🎯 Command Mode
- Natural language to Windows CMD commands
- AI reasoning display
- Automatic safety checks for dangerous commands
- Interactive confirmation for destructive operations
- Real-time command output streaming

### 💬 Chat Mode
- Interactive conversations with AI assistant
- Beautiful markdown rendering (code blocks, tables, lists)
- Context-aware responses with conversation history
- Session management (clear history, start fresh)

### 🛡️ Security
- Admin command detection
- Dangerous operation warnings
- System path protection
- User confirmation for risky commands

---

## 📦 Installation

### Global Installation (Recommended)

```bash
npm install -g terminal-ai-assistant
```

### Local Installation

```bash
npm install terminal-ai-assistant
```

### From Source

```bash
git clone https://github.com/Rushikeshnimkar/terminal-ai-assistant-windows
cd terminal-ai-assistant-windows
npm install
npm run build
npm link
```

---

## 🚀 Usage

### Command Mode

Generate and execute commands from natural language:

```bash
t-ai "create a new folder called projects"
t-ai "list all files in current directory"
t-ai "find all pdf files"
```

#### With Options

```bash
# Start a new conversation (clears history)
t-ai -n "show disk space"

# Enable debug mode
t-ai -d "copy files"

# Display help
t-ai --help
```

### Interactive Chat Mode

Start a conversation with your AI assistant:

```bash
t-ai chat
```

#### Chat Commands
- Type your questions or requests naturally
- `exit` or `quit` - End the chat session
- `clear` - Clear conversation history
- `banner` - Show the T-AI banner again
- Press Enter on empty input to skip

#### Chat Example

```
❯ How do I check my system's IP address?

╭─ T-AI
│
│ ▓▓ IP Address Checking ▓▓
│
│ You can check your system's IP address using several methods:
│
│   1. Using ipconfig command
│   2. Using PowerShell
│   3. Via Network Settings
│
│ ┌─ cmd ─
│ │ ipconfig | findstr IPv4
│ └─
│
│ This will display your IPv4 address for all network adapters.
│
╰─ 14:30:25
```

### History Management

```bash
# Clear conversation history
t-ai clear-history

# Start fresh conversation in chat mode
t-ai chat -n
```

---

## 💡 Examples

### File Operations

```bash
t-ai "create a backup folder and a readme file inside it"
t-ai "copy all .txt files to backup folder"
t-ai "delete all temporary files older than 30 days"
```

### System Information

```bash
t-ai "show me detailed system information"
t-ai "check disk space on all drives"
t-ai "list all running processes"
```

### Network Commands

```bash
t-ai "show my IP address and network configuration"
t-ai "test internet connection to google.com"
t-ai "find which process is using port 8080"
```

---

## 🏗️ Project Structure

```
terminal-ai-assistant/
├── src/
│   ├── cli.ts                    # Main CLI entry point with command routing
│   ├── services/
│   │   ├── aiService.ts          # AI API integration and response handling
│   │   ├── commandService.ts     # Command execution with real-time streaming
│   │   ├── historyService.ts     # Conversation history management
│   │   └── fileSystemService.ts  # File system utilities and safety checks
│   ├── types/
│   │   └── index.ts              # TypeScript type definitions
│   └── utils/
│       └── prompt.ts             # User interaction utilities
├── dist/                         # Compiled JavaScript output
├── package.json                  # Project configuration and dependencies
├── tsconfig.json                 # TypeScript configuration
└── README.md                     # This file
```

---

## 🔧 Technology Stack

| Technology | Purpose |
|------------|---------|
| **TypeScript** | Type-safe development with modern JavaScript features |
| **Node.js** | Runtime environment for CLI application |
| **MiniMax M2** | Advanced AI model for command generation and chat |
| **Commander.js** | Robust CLI framework with command parsing |
| **Chalk** | Beautiful terminal string styling |
| **Marked** | Markdown parsing for chat responses |
| **Marked-Terminal** | Terminal-optimized markdown rendering |
| **Readline-Sync** | Synchronous user input handling |
| **FS-Extra** | Enhanced file system operations |

---

## 🛡️ Security

T-AI includes built-in safety features:

- **Dangerous Command Detection**: Warns before executing destructive operations
- **Admin Privilege Alerts**: Flags commands requiring elevated access
- **System Path Protection**: Prevents accidental system directory modifications
- **User Confirmation**: Requires approval for risky commands like `del`, `format`, `diskpart`

```bash
# Example: T-AI will warn you before executing dangerous commands
t-ai "delete all files in system32"

# Output:
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃  ⚠  WARNING: POTENTIALLY DANGEROUS  ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

▶ Execute this command? (y/n)
```

---

## 🎨 Output Formatting

### Command Mode
```
┌─ AI Analysis ─
│ Creating a new directory named 'projects'
└─

┌─ Generated Command ─
│ mkdir projects
└─

✓ Command completed successfully
```

### Chat Mode
- Formatted headings, lists, and tables
- Syntax-highlighted code blocks
- Styled blockquotes and emphasis
- Timestamped responses

---



## 🤝 Contributing

Contributions are welcome!

```bash
# Clone and setup
git clone https://github.com/Rushikeshnimkar/terminal-ai-assistant-windows
cd terminal-ai-assistant-windows
npm install
npm run build
npm link

# Test your changes
t-ai "test command"
```

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📝 Version History

- **v1.0.19** - Current release with enhanced chat mode and markdown rendering
- **v1.0.8** - Added interactive chat mode and custom ASCII banner
- **v1.0.0** - Initial release

---

## 💬 Support

Need help? 

- Check [existing issues](https://github.com/Rushikeshnimkar/terminal-ai-assistant-windows/issues)
- Open a [new issue](https://github.com/Rushikeshnimkar/terminal-ai-assistant-windows/issues/new)
- Star the repo ⭐ if you find it helpful!

---


[⬆ Back to Top](#terminal-ai-assistant-t-ai)

</div>
