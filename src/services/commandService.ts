import { exec } from 'child_process';
import { CommandResult } from '../types/index.js';

declare global {
    interface Window {
        electronAPI: {
            executeCommand: (command: string) => Promise<CommandResult>;
        }
    }
}

export const executeCommand = async (command: string): Promise<CommandResult> => {
    return new Promise((resolve) => {
        exec(command, { encoding: 'utf8' }, (error, stdout, stderr) => {
            if (error) {
                resolve({
                    success: false,
                    output: '',
                    error: error.message
                });
                return;
            }

            resolve({
                success: true,
                output: stdout || stderr,
                error: null
            });
        });
    });
}; 