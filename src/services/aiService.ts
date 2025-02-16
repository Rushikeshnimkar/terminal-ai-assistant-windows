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
        'takeown', 'icacls', 'attrib', 'cacls', 'runas'
    ]);

    private static readonly TIMEOUT = 30000;
    private static readonly MAX_RETRIES = 3;
    private static readonly RETRY_DELAY = 1000;

    private static createPrompt(userInput: string): string {
        return `Task: Generate a valid Windows Command Prompt command.
Current directory: ${this.CURRENT_DIR}
User request: ${userInput}

Requirements:
1. Provide only the command without explanation.
2. Use relative paths where applicable.
3. No PowerShell commands, only CMD-compatible commands.
4. The command must be safe and executable in Windows CMD.
5. Ensure correct syntax for "for" loops and file redirections.
6.no repetation of commands

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

    private static validateResponse(data: OpenRouterResponse): string {
        if (!data?.choices?.[0]?.message?.content) {
            throw new AIError('Invalid or empty response from AI', 'INVALID_RESPONSE');
        }
    
        let content = data.choices[0].message.content.trim();
        if (!content) {
            throw new AIError('AI returned an empty command', 'EMPTY_COMMAND');
        }
    
        // Remove duplicate lines
        const lines = content.split(/\r?\n/).map(line => line.trim());
        const uniqueLines = [...new Set(lines)]; // Remove duplicates
    
        return uniqueLines.join(' '); // Ensure a single clean command
    }
    

    private static cleanCommand(command: string): string {
        let cleanedCommand = command
            .replace(/```[\s\S]*?```/g, '') // Remove code block formatting
            .replace(/`/g, '') // Remove backticks
            .replace(/\n/g, ' ') // Convert newlines to spaces
            .replace(/\s+/g, ' ') // Normalize spaces
            .replace(/^[>$\s]+/, '') // Remove prompt characters
            .replace(/^cmd\s*\/c\s*/i, '') // Remove redundant prefixes
            .trim();
    
        // Fix repeated command issues (e.g., "color 2color 2" -> "color 2")
        cleanedCommand = cleanedCommand.replace(/\b(\w+ \d?)\s*\1\b/gi, '$1');
    
        return cleanedCommand;
    }
    
    
    
    

    private static validateCommand(command: string): void {
        if (!command) {
            throw new AIError('Command is empty after cleaning', 'EMPTY_COMMAND');
        }
    
        if (this.requiresAdminPrivileges(command)) {
            throw new AIError('This command requires administrator privileges', 'ADMIN_REQUIRED');
        }
    
        // Ensure correct redirection use
        const redirectionCount = (command.match(/(?<!>)>/g) || []).length; // Only count `>` (not `>>`)
        if (redirectionCount > 1) {
            throw new AIError('Too many output redirections in command', 'INVALID_REDIRECTION');
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
            const content = this.validateResponse(data);
            
            // Clean and validate the command
            const command = this.cleanCommand(content);
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
