#!/usr/bin/env node

import { Command } from "commander";
import chalk from "chalk";
import { AIService } from "./services/aiService.js";
import { executeCommand } from "./services/commandService.js";
import { HistoryService } from "./services/historyService.js";
import { promptConfirmation } from "./utils/prompt.js"; // Make sure path is correct

const program = new Command();

program
  .name("tai")
  .description("AI-powered terminal assistant")
  .version("1.0.6")
  .argument("<query>", "What you want to do")
  .option("-d, --debug", "Enable debug mode (not implemented)")
  .option("-n, --new-conversation", "Start a new conversation")
  .action(
    async (
      query: string,
      options: { debug?: boolean; newConversation?: boolean }
    ) => {
      try {
        await HistoryService.init();

        if (options.newConversation) {
          await HistoryService.clearHistory();
          console.log(chalk.blue("Started a new conversation"));
        }

        console.log(chalk.blue("🔄 Thinking..."));

        const [command, reasoning] = await AIService.generateCommand(query);

        console.log(chalk.cyan("🤖 AI's Plan:"));
        console.log(chalk.cyan(`   ${reasoning}`));
        console.log(chalk.yellow("📝 Command:"));
        console.log(chalk.yellow.bold(`   ${command}`));
        console.log("---"); // Separator

        // SAFETY CHECK
        if (AIService.isPotentiallyDangerous(command)) {
          console.log(
            chalk.red.bold(
              "⚠️  WARNING: This command could be destructive or require admin rights."
            )
          );
          const confirmed = await promptConfirmation(
            chalk.yellow("Are you sure you want to execute this? (y/n) ")
          );

          if (!confirmed) {
            console.log(chalk.red("Execution cancelled."));
            process.exit(0);
          }
          console.log(chalk.green("Executing confirmed command..."));
        } else {
          console.log(chalk.blue("⚡ Executing..."));
        }

        // Execute the command (output is now streamed)
        const result = await executeCommand(command);

        if (result.success) {
          console.log(chalk.green("✅ Command finished successfully."));
        } else {
          console.log(chalk.red("❌ Command failed:"), result.error);
        }
      } catch (error) {
        console.error(
          chalk.red(
            "❌ Fatal Error:",
            error instanceof Error ? error.message : "Unknown error"
          )
        );
        process.exit(1);
      }
    }
  );

// Remove the 'new-session' command as it's redundant with '--new-conversation'
program
  .command("clear-history")
  .description("Start a new conversation session")
  .action(async () => {
    await HistoryService.init(); // ensure it's initialized
    await HistoryService.clearHistory();
    console.log(chalk.green("Conversation history cleared."));
  });

program.parse();
