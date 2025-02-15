const { contextBridge } = require('electron');
const { exec } = require('child_process');

contextBridge.exposeInMainWorld('electronAPI', {
    executeCommand: (command: string) => {
        return new Promise((resolve) => {
            // List of commands that require admin privileges
            const adminCommands = [
                'netsh',
                'net',
                'sc',
                'reg',
                'bcdedit',
                'diskpart',
                'dism',
                'sfc'
            ];

            // Check if command requires admin privileges
            const requiresAdmin = adminCommands.some(cmd => 
                command.toLowerCase().startsWith(cmd.toLowerCase())
            );

            if (requiresAdmin) {
                resolve({
                    success: false,
                    output: '',
                    error: 'This command requires administrator privileges. Please run the application as administrator.'
                });
                return;
            }

            // Execute command with proper error handling
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
    }
});

// Ensure TypeScript knows about our API
export type ElectronAPI = {
    executeCommand: (command: string) => Promise<{
        success: boolean;
        output: string;
        error: string | null;
    }>;
};

declare global {
    interface Window {
        electronAPI: ElectronAPI;
    }
} 