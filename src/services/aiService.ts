import chalk from "chalk";

interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
    refusal?: null;
}

interface OpenRouterResponse {
    id: string;
    provider: string;
    model: string;
    object: string;
    created: number;
    choices: [{
        index: number;
        message: ChatMessage;
        finish_reason: string;
        native_finish_reason: string;
        logprobs?: any;
    }];
    usage: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
}

class AIError extends Error {
    constructor(message: string, public code: string) {
        super(message);
        this.name = 'AIError';
    }
}

export class AIService {
    private static readonly API_URL = 'https://terminal-ai-api.vercel.app/api';
    private static readonly CURRENT_DIR = process.cwd();
    private static readonly ADMIN_COMMANDS: Set<string> = new Set([
        'netsh', 'net', 'sc', 'reg', 'bcdedit', 'diskpart', 'dism', 'sfc',
        'format', 'chkdsk', 'taskkill', 'rd /s', 'rmdir /s', 'del /f',
        'takeown', 'icacls', 'attrib', 'runas'
    ]);

    private static readonly TIMEOUT = 30000;
    private static readonly MAX_RETRIES = 3;
    private static readonly RETRY_DELAY = 1000;

    private static createPrompt(userInput: string): string {
        return `Task: Generate a valid Windows Command Prompt command.
Current directory: ${this.CURRENT_DIR}
User request: ${userInput}

Requirements:
1. Provide ONLY ONE single command without explanation or repetition.
2. Use relative paths where applicable.
3. No PowerShell commands, only CMD-compatible commands.
4. The command must be safe and executable in Windows CMD.


Your response:`;
    }

    private static async fetchWithRetry(url: string, options: RequestInit): Promise<Response> {
        let lastError: Error | null = null;

        for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), this.TIMEOUT);

                const response = await fetch(url, {
                    ...options,
                    signal: controller.signal
                });

                clearTimeout(timeoutId);

                if (!response.ok) {
                    throw new AIError(
                        `API returned ${response.status}: ${await response.text()}`,
                        'API_ERROR'
                    );
                }

                return response;
            } catch (error) {
                lastError = error instanceof Error ? error : new Error('Unknown error');

                if (error instanceof Error && error.name === 'AbortError') {
                    throw new AIError('Request timed out', 'TIMEOUT');
                }

                if (attempt === this.MAX_RETRIES) {
                    break;
                }

                await new Promise(resolve => setTimeout(resolve, this.RETRY_DELAY * attempt));
            }
        }

        throw new AIError(
            `Failed after ${this.MAX_RETRIES} attempts: ${lastError?.message}`,
            'MAX_RETRIES_EXCEEDED'
        );
    }

    private static removeCommandRepetitions(command: string): string {
        const trimmedCommand = command.trim();
        const length = trimmedCommand.length;
        
        // If command length is odd, it can't be a perfect repetition
        if (length % 2 !== 0) {
            return trimmedCommand;
        }
        
        const halfLength = length / 2;
        const firstHalf = trimmedCommand.slice(0, halfLength);
        const secondHalf = trimmedCommand.slice(halfLength);
        
        // If both halves are identical, return just one half
        return firstHalf === secondHalf ? firstHalf : trimmedCommand;
    }

    private static validateResponse(data: OpenRouterResponse): string {
        if (!data?.choices?.[0]?.message?.content) {
            throw new AIError('Invalid or empty response from AI', 'INVALID_RESPONSE');
        }
    
        let content = data.choices[0].message.content.trim();
        if (!content) {
            throw new AIError('AI returned an empty command', 'EMPTY_COMMAND');
        }
    
        // Take only the first non-empty line as the command
        const lines = content.split(/\r?\n/).map(line => line.trim());
        const firstValidLine = lines.find(line => line.length > 0);
        
        if (!firstValidLine) {
            throw new AIError('No valid command found in AI response', 'INVALID_RESPONSE');
        }
    
        // Remove any command repetitions before returning
        return this.removeCommandRepetitions(firstValidLine);
    }
    

    private static cleanCommand(command: string): string {
        // First, clean the basic formatting
        let cleanedCommand = command
            .trim();
    
        // Store URLs temporarily with a placeholder
        const urls: string[] = [];
        cleanedCommand = cleanedCommand.replace(/(https?:\/\/[^\s]+)/g, (match) => {
            urls.push(match);
            return `__URL${urls.length - 1}__`;
        });
    
        // Handle common commands with their parameters
        const commonCommands = {
            'ipconfig': ['/all', '/release', '/renew', '/flushdns'],
            'dir': ['/a', '/b', '/s', '/w', '/p', '/o', '/ad'],
            'netstat': ['-a', '-n', '-b', '-o'],
            'ping': ['-t', '-a', '-n', '-l'],
            'curl': ['-s', '-o', '-L', '-I', '-H']
        };
    
        // Find the base command
        const firstWord = cleanedCommand.split(' ')[0].toLowerCase();
        
        if (commonCommands[firstWord as keyof typeof commonCommands]) {
            // Extract all valid parameters for this command
            const validParams = commonCommands[firstWord as keyof typeof commonCommands];
            const params = new Set<string>();
            
            // Find all parameters in the command
            const paramMatches = cleanedCommand.match(/\/[a-zA-Z]+|-[a-zA-Z]+/g) || [];
            
            // Keep only valid, unique parameters
            paramMatches.forEach(param => {
                if (validParams.includes(param.toLowerCase())) {
                    params.add(param.toLowerCase());
                }
            });
    
            // Reconstruct the command with unique parameters
            cleanedCommand = firstWord + ' ' + Array.from(params).join(' ');
        } else {
            // For unknown commands, just take the first instance of the command and its immediate parameters
            const parts = cleanedCommand.split(' ');
            const baseCommand = parts[0];
            let parameters = [];
            
            // Collect parameters until we hit another instance of the base command
            for (let i = 1; i < parts.length; i++) {
                if (parts[i].toLowerCase() === baseCommand.toLowerCase()) {
                    break;
                }
                parameters.push(parts[i]);
            }
            
            cleanedCommand = baseCommand + (parameters.length ? ' ' + parameters.join(' ') : '');
        }
    
        // Restore URLs
        urls.forEach((url, index) => {
            cleanedCommand = cleanedCommand.replace(`__URL${index}__`, url);
        });
    
        // Fix path separators (only for Windows paths, not URLs or parameters)
        cleanedCommand = cleanedCommand.replace(/(?<!http:|https:)\/\//g, '\\');
    
        // Ensure command doesn't start with an invalid character
        if (/^[^a-zA-Z0-9]/.test(cleanedCommand)) {
            throw new AIError('Invalid command structure', 'INVALID_COMMAND');
        }
    
        return cleanedCommand;
    }
    
    
    private static validateCommand(command: string): void {
        if (!command) {
            throw new AIError('Command is empty after cleaning', 'EMPTY_COMMAND');
        }
    
        if (this.requiresAdminPrivileges(command)) {
            throw new AIError('This command requires administrator privileges', 'ADMIN_REQUIRED');
        }
    
        // Updated redirection validation to allow for complex commands
        // Allow multiple redirections if they're part of different command segments (separated by & or |)
        const commandSegments = command.split(/[&|]/);
        for (const segment of commandSegments) {
            // Count redirections within each command segment
            const redirectionCount = (segment.match(/(?<!>)>/g) || []).length;
            if (redirectionCount > 1) {
                throw new AIError('Too many output redirections in a single command segment', 'INVALID_REDIRECTION');
            }
        }
    }
    

    private static requiresAdminPrivileges(command: string): boolean {
        const commandLower = command.toLowerCase();
        return Array.from(this.ADMIN_COMMANDS).some(adminCmd => 
            commandLower.includes(adminCmd.toLowerCase())
        );
    }

    static async generateCommand(userInput: string): Promise<[string, string?]> {
        try {
            if (!userInput?.trim()) {
                throw new AIError('User input is required', 'INVALID_INPUT');
            }

            const response = await this.fetchWithRetry(this.API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: this.createPrompt(userInput) })
            });

            const data: OpenRouterResponse = await response.json();
            const command = this.validateResponse(data);
            this.validateCommand(command);

            return [command];
        } catch (error) {
            if (error instanceof AIError) {
                throw error;
            }
            throw new Error('An unexpected error occurred during command generation');
        }
    }
}
