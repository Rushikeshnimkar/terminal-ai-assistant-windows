import { createDecipheriv } from 'crypto';

interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
}

interface HyperbolicResponse {
    choices: [{
        message: {
            content: string;
        }
    }];
}

export class AIService {
    private static readonly API_URL = 'https://api.hyperbolic.xyz/v1/chat/completions';
    private static readonly MODEL_NAME = 'deepseek-ai/DeepSeek-V3';
    private static readonly CURRENT_DIR = process.cwd();
    private static readonly ADMIN_COMMANDS: Set<string> = new Set([
        'netsh', 'net', 'sc', 'reg', 'bcdedit', 'diskpart', 'dism', 'sfc'
    ]);

    // Replace with your encrypted values from the encryption script
    private static readonly ENCRYPTED_KEY = '4bb5d368c276976857528aac9cb1a3cbae7d827e52d8830b66bcd7245dbfb858ebdc646aac8f6b311daf96815fd41e29f8ff77cc2e1d5a65ec4165e428e1caf84e80e202b3514b69298b8dfe630c83fd4a95efb7ae3aa5604eed97b719105d6771aa4546b10d85b2160f269b5aa65677bc9b4d7059a1f8debd286334c3df69fad1770f023e057f1ed2edf2f0d67184d73c459d787a2b44013f857ffee2cb2f1d';
    private static readonly ENCRYPTION_KEY = 'c33ab585f68714e93e44f48b92d4ae97384f9268286a4626204603807378f92a';
    private static readonly IV = 'e7a1dcc972e2c9d0d609c929328e40e7';

    private static getApiKey(): string {
        try {
            const decipher = createDecipheriv(
                'aes-256-cbc',
                Buffer.from(this.ENCRYPTION_KEY, 'hex'),
                Buffer.from(this.IV, 'hex')
            );
            
            let decrypted = decipher.update(this.ENCRYPTED_KEY, 'hex', 'utf8');
            decrypted += decipher.final('utf8');
            return decrypted;
        } catch (error) {
            throw new Error('Failed to decrypt API key');
        }
    }

    private static async fetchWithTimeout(url: string, options: RequestInit, timeout = 60000) {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), timeout);

        try {
            const response = await fetch(url, {
                ...options,
                signal: controller.signal
            });
            clearTimeout(id);
            return response;
        } catch (error) {
            clearTimeout(id);
            if (error instanceof Error && error.name === 'AbortError') {
                throw new Error('Request timed out. Please try again.');
            }
            throw error;
        }
    }

    static async generateCommand(userInput: string): Promise<string[]> {
        try {
            const apiKey = this.getApiKey();
            const currentDir = this.CURRENT_DIR;

            const messages: ChatMessage[] = [{
                role: 'user',
                content: `You are in the Windows Command Prompt at: ${currentDir}>
Generate a command for this task: "${userInput}"
Rules:
- Output ONLY the command, no explanations
- Consider you're already in ${currentDir}
- Use absolute paths for other drives (e.g., D:\\)
- Use relative paths for current directory
- No backticks or code blocks
- Generate efficient commands`
            }];

            const response = await this.fetchWithTimeout(this.API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`,
                },
                body: JSON.stringify({
                    messages,
                    model: this.MODEL_NAME,
                    max_tokens: 512,
                    temperature: 0.1,
                    top_p: 0.9,
                    stream: false
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`API Error (${response.status}): ${errorText}`);
            }

            const data: HyperbolicResponse = await response.json();
            
            if (!data?.choices?.[0]?.message?.content) {
                throw new Error('Invalid response from API');
            }

            const command = this.cleanCommand(data.choices[0].message.content);

            if (this.requiresAdminPrivileges(command)) {
                throw new Error('This command requires administrator privileges.');
            }

            return [command];
        } catch (error) {
            if (error instanceof Error) {
                throw new Error(`Command generation failed: ${error.message}`);
            }
            throw new Error('An unexpected error occurred');
        }
    }

    private static cleanCommand(command: string): string {
        return command
            .replace(/```[\s\S]*?```/g, '')
            .replace(/`/g, '')
            .replace(/\n/g, ' ')
            .trim();
    }

    private static requiresAdminPrivileges(command: string): boolean {
        const baseCommand = command.split(' ')[0].toLowerCase();
        return this.ADMIN_COMMANDS.has(baseCommand);
    }
}