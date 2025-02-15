# Terminal AI Assistant

A powerful CLI tool that helps users interact with the Windows command line using natural language. Built with Node.js and powered by DeepSeek-V3 AI.

## Features

- 🤖 Natural language to command conversion
- 💻 Real-time command execution
- 🛡️ Secure command handling
- ⚡ Fast response times
- 🔒 Built-in API key encryption
- 🖥️ Cross-platform support

## Installation

```bash
npm install -g terminal-ai-assistant
```

## Usage

After installation, you can use the `tai` command followed by your natural language query:

```bash
tai "create a new folder called projects"
tai "list all files in current directory"
tai "find all pdf files in downloads folder"
```

## Examples

### File operations:
```bash
tai "create a backup of important.txt"
tai "delete all temporary files"
tai "move all images to pictures folder"
```

### System information:
```bash
tai "show system information"
tai "list running processes"
tai "check disk space"
```

### Network commands:
```bash
tai "show my ip address"
tai "test internet connection"
```

## Project Structure

```
terminal-ai-assistant/
├── src/ # Source files
│ ├── services/ # Service layer
│ │ ├── aiService.ts # AI command generation
│ │ └── commandService.ts # Command execution
│ ├── types/ # TypeScript types
│ └── cli.ts # CLI entry point
├── tsconfig.json # TypeScript configuration
└── package.json # Project configuration
```

## Technology Stack

- 🟦 TypeScript - Type safety and modern JavaScript features
- 🤖 DeepSeek-V3 - Advanced AI model for command generation
- 🔐 Node.js crypto - Secure API key handling
- 🎨 Chalk - Beautiful terminal output
- 📝 Commander.js - CLI framework

## Security Features

- Encrypted API key storage
- Admin command detection
- Secure command execution
- Input sanitization

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Author

Rushikesh Nimkar

## Acknowledgments

- [DeepSeek AI](https://deepseek.ai)
- [Node.js](https://nodejs.org/)
- [Commander.js](https://github.com/tj/commander.js/)

