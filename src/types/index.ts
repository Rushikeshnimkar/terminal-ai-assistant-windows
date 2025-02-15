export interface Command {
    id: string;
    description: string;
    command: string;
    category: string;
}

export interface CommandResult {
    success: boolean;
    output: string;
    error: string | null;
}

