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
        return `Task: Generate a Windows command prompt command.
Current directory: ${this.CURRENT_DIR}
User request: ${userInput}

Requirements:
1. Output ONLY the command with no explanations
2. For current directory, use relative paths
3. For other drives, use absolute paths (e.g., D:\\)
4. Use backslashes (\\) for paths
5. Keep forward slashes (/) for command parameters
6. No PowerShell commands
7. No backticks or code blocks
8. Command must be executable in Windows CMD

Example format:
User: "list files"
Output: dir /B

User: "show hidden files"
Output: dir /A:H

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

        const content = data.choices[0].message.content.trim();
        if (!content) {
            throw new AIError('AI returned empty command', 'EMPTY_COMMAND');
        }

        return content;
    }

    private static cleanCommand(command: string): string {
        return command
            .replace(/```[\s\S]*?```/g, '')
            .replace(/`/g, '')
            .replace(/\n/g, ' ')
            .replace(/\s+/g, ' ')
            .replace(/([^/])\/([^/])/g, '$1\\$2')
            .replace(/^[>$\s]+/, '')
            .replace(/^cmd\s*\/c\s*/i, '')
            .trim();
    }

    private static validateCommand(command: string): void {
        if (!command) {
            throw new AIError('Command is empty after cleaning', 'EMPTY_COMMAND');
        }

        if (this.requiresAdminPrivileges(command)) {
            throw new AIError('This command requires administrator privileges', 'ADMIN_REQUIRED');
        }
    }

    private static requiresAdminPrivileges(command: string): boolean {
        const commandLower = command.toLowerCase();
        return Array.from(this.ADMIN_COMMANDS).some(adminCmd => 
            commandLower.includes(adminCmd.toLowerCase())
        );
    }

    static async generateCommand(userInput: string): Promise<string[]> {
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
            const command = this.cleanCommand(content);
            this.validateCommand(command);

            return [command];
        } catch (error) {
            if (error instanceof AIError) {
                throw new Error(`Command generation failed (${error.code}): ${error.message}`);
            }
            throw new Error('An unexpected error occurred during command generation');
        }
    }
}