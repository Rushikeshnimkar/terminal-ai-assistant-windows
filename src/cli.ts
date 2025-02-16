#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { AIService } from './services/aiService.js';
import { executeCommand } from './services/commandService.js';

const program = new Command();

program
    .name('ta')
    .description('AI-powered terminal assistant')
    .version('1.0.0')
    .argument('<query>', 'What you want to do')
    .action(async (query: string) => {
        try {
            console.log(chalk.blue('🔄 Generating command...'));
            const [command] = await AIService.generateCommand(query);
            
            // Display only the command
            console.log(chalk.yellow('📝 Command:', command));

            console.log(chalk.blue('⚡ Executing...'));
            const result = await executeCommand(command);

            if (result.success) {
                console.log(chalk.green('✅ Output:'));
                console.log(result.output || '(No output)');
            } else {
                console.log(chalk.red('❌ Error:', result.error));
            }
        } catch (error) {
            console.error(chalk.red('❌ Error:', error instanceof Error ? error.message : 'Unknown error'));
            process.exit(1);
        }
    });

program.parse(); 