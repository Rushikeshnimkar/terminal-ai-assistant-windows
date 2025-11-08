#!/usr/bin/env node

import { Command } from "commander";
import chalk from "chalk";
import { AIService } from "./services/aiService.js";
import { executeCommand } from "./services/commandService.js";
import { HistoryService } from "./services/historyService.js";
import { promptConfirmation } from "./utils/prompt.js";

// --- NEW IMPORTS ---
import readlineSync from "readline-sync";
import { Marked } from "marked";
import type { Tokens, RendererObject } from "marked";

const program = new Command();

// --- Huge ASCII Art Banner with Logo ---
const banner = `

           ${chalk.cyan(
             "⚡"
           )}                                                    ${chalk.cyan(
  "⚡"
)}
         ${chalk.cyan(
           "▄▄▄"
         )}                                                  ${chalk.cyan(
  "▄▄▄"
)}
       ${chalk.cyan(
         "▄█████▄"
       )}                                              ${chalk.cyan("▄█████▄")}
      ${chalk.cyan(
        "███████████"
      )}                                        ${chalk.cyan("███████████")}
     ${chalk.cyan(
       "█████████████"
     )}                                      ${chalk.cyan("█████████████")}

          ${chalk.magenta.bold("████████╗")}    ${chalk.blue.bold(
  "    █████╗"
)}    ${chalk.green.bold("    ██╗")}
          ${chalk.magenta.bold("╚══██╔══╝")}    ${chalk.blue.bold(
  "   ██╔══██╗"
)}   ${chalk.green.bold("    ██║")}
          ${chalk.magenta.bold("   ██║")}       ${chalk.blue.bold(
  "   ███████║"
)}   ${chalk.green.bold("    ██║")}
          ${chalk.magenta.bold("   ██║")}       ${chalk.blue.bold(
  "   ██╔══██║"
)}   ${chalk.green.bold("    ██║")}
          ${chalk.magenta.bold("   ██║")}       ${chalk.blue.bold(
  "   ██║  ██║"
)}   ${chalk.green.bold("    ██║")}
          ${chalk.magenta.bold("   ╚═╝")}       ${chalk.blue.bold(
  "   ╚═╝  ╚═╝"
)}   ${chalk.green.bold("    ╚═╝")}

     ${chalk.cyan(
       "█████████████"
     )}                                      ${chalk.cyan("█████████████")}
      ${chalk.cyan(
        "███████████"
      )}                                        ${chalk.cyan("███████████")}
       ${chalk.cyan(
         "▀█████▀"
       )}                                              ${chalk.cyan("▀█████▀")}
         ${chalk.cyan(
           "▀▀▀"
         )}                                                  ${chalk.cyan(
  "▀▀▀"
)}
           ${chalk.cyan(
             "⚡"
           )}                                                    ${chalk.cyan(
  "⚡"
)}

                    ${chalk.yellow.bold("YOUR AI-POWERED TERMINAL ASSISTANT")}
                         ${chalk.dim("━━━━━━━━━━━━━━━━━━━━━━━━━━")}
                    ${chalk.green("●")} ${chalk.white("Online")}  ${chalk.dim(
  "│"
)}  ${chalk.yellow("v1.0.8")}  ${chalk.dim("│")}  ${chalk.cyan("AI-Powered")}

`;

// --- NEW: Setup Custom Terminal Renderer ---
const terminalRenderer: RendererObject = {
  // Block-level tokens
  heading({ text, depth }: Tokens.Heading): string {
    switch (depth) {
      case 1:
        return chalk.bold.magentaBright(`\n▓▓ ${text} ▓▓\n\n`);
      case 2:
        return chalk.bold.cyan(`\n▒▒ ${text}\n\n`);
      case 3:
        return chalk.bold.blue(`\n░░ ${text}\n`);
      default:
        return chalk.bold.white(`\n${"▪".repeat(depth)} ${text}\n`);
    }
  },

  paragraph({ text }: Tokens.Paragraph): string {
    return `${text}\n\n`;
  },

  code({ text, lang }: Tokens.Code): string {
    const language = lang || "";
    return `\n${chalk.dim(
      "┌─ " + (language ? chalk.cyan(language) : "code") + " ─"
    )}\n${chalk.yellow("│ " + text.split("\n").join("\n│ "))}\n${chalk.dim(
      "└─"
    )}\n\n`;
  },

  list({ items, ordered }: Tokens.List): string {
    let out = "\n";
    items.forEach((item, index) => {
      const prefix = ordered ? chalk.cyan(`${index + 1}.`) : chalk.magenta("●");
      const text = item.text.replace(/<\/?p>/g, "").trim();
      out += `  ${prefix} ${text}\n`;
    });
    return out + "\n";
  },

  listitem({ text }: Tokens.ListItem): string {
    return text;
  },

  blockquote({ text }: Tokens.Blockquote): string {
    const lines = text.trim().split("\n");
    const quotedLines = lines.map(
      (line) => `${chalk.blue("┃")} ${chalk.italic.gray(line)}`
    );
    return `\n${quotedLines.join("\n")}\n\n`;
  },

  hr(_token: Tokens.Hr): string {
    return `\n${chalk.dim("─".repeat(60))}\n\n`;
  },

  // Inline-level tokens
  strong({ text }: Tokens.Strong): string {
    return chalk.bold.white(text);
  },

  em({ text }: Tokens.Em): string {
    return chalk.italic(text);
  },

  codespan({ text }: Tokens.Codespan): string {
    return chalk.bgBlack.yellow(` ${text} `);
  },

  del({ text }: Tokens.Del): string {
    return chalk.strikethrough.dim(text);
  },

  link({ href, text }: Tokens.Link): string {
    return `${chalk.cyan.underline(text)} ${chalk.dim(`(${href})`)}`;
  },

  image({ text }: Tokens.Image): string {
    return chalk.dim(`[🖼  ${text}]`);
  },

  text({ text }: Tokens.Text | Tokens.Escape): string {
    return text;
  },

  space(_token: Tokens.Space): string {
    return "";
  },

  br(_token: Tokens.Br): string {
    return "\n";
  },

  html(token: Tokens.HTML | Tokens.Tag): string | false {
    // If token is HTML, strip tags. If token is Tag, return empty string (or false).
    if ("text" in token) {
      return token.text.replace(/<[^>]*>/g, "");
    }
    return "";
  },

  table({ header, rows }: Tokens.Table): string {
    let output = "\n";

    // Header
    const headerText = header.map((cell) => cell.text).join(" │ ");
    output += chalk.bold.cyan(headerText) + "\n";
    output += chalk.dim("─".repeat(Math.min(headerText.length, 60))) + "\n";

    // Rows
    rows.forEach((row) => {
      const rowText = row.map((cell) => cell.text).join(" │ ");
      output += rowText + "\n";
    });

    return output + "\n";
  },
};

// Create marked instance with custom renderer
const marked = new Marked();
marked.use({ renderer: terminalRenderer });

// --- Helper Functions for Modern UI ---
const displayBanner = () => {
  console.clear();
  console.log(banner);
};

const spinner = {
  frames: ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"],
  current: 0,
  interval: null as NodeJS.Timeout | null,

  start(message: string) {
    this.current = 0;
    this.interval = setInterval(() => {
      process.stdout.write(
        `\r${chalk.cyan(this.frames[this.current])} ${chalk.dim(message)}`
      );
      this.current = (this.current + 1) % this.frames.length;
    }, 80);
  },

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
      process.stdout.write("\r" + " ".repeat(50) + "\r");
    }
  },
};

// --- UPDATED: Program Name ---
program
  .name("T-AI")
  .description("AI-powered terminal assistant")
  .version("1.0.8");

// --- Command-generation mode ---
program
  .argument("[query]", "What you want to do (command mode)")
  .option("-d, --debug", "Enable debug mode")
  .option("-n, --new-conversation", "Start a new conversation")
  .action(
    async (
      query: string | undefined,
      options: { debug?: boolean; newConversation?: boolean }
    ) => {
      if (!query) {
        displayBanner();
        console.log(
          chalk.dim("Use") +
            chalk.cyan(" t-ai chat ") +
            chalk.dim("to start interactive mode")
        );
        console.log(
          chalk.dim("Use") +
            chalk.cyan(" t-ai --help ") +
            chalk.dim("to see all options\n")
        );
        return;
      }

      try {
        await HistoryService.init();

        if (options.newConversation) {
          await HistoryService.clearHistory();
          console.log(chalk.green("✨ Started a new conversation"));
        }

        spinner.start("Analyzing your request...");

        const [command, reasoning] = await AIService.generateCommand(query);

        spinner.stop();

        console.log(
          chalk.cyan("┌─ ") + chalk.bold.cyan("AI Analysis") + chalk.cyan(" ─")
        );
        console.log(chalk.cyan("│ ") + chalk.dim(reasoning));
        console.log(chalk.cyan("└─\n"));

        console.log(
          chalk.yellow("┌─ ") +
            chalk.bold.yellow("Generated Command") +
            chalk.yellow(" ─")
        );
        console.log(chalk.yellow("│ ") + chalk.bold.white(command));
        console.log(chalk.yellow("└─\n"));

        if (AIService.isPotentiallyDangerous(command)) {
          console.log(chalk.red("┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓"));
          console.log(
            chalk.red("┃") +
              chalk.bold.red("  ⚠  WARNING: POTENTIALLY DANGEROUS  ") +
              chalk.red("┃")
          );
          console.log(chalk.red("┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛\n"));

          const confirmed = await promptConfirmation(
            chalk.yellow("▶ Execute this command? (y/n) ")
          );

          if (!confirmed) {
            console.log(chalk.red("✗ Execution cancelled\n"));
            process.exit(0);
          }
        }

        spinner.start("Executing command...");
        const result = await executeCommand(command);
        spinner.stop();

        if (result.success) {
          console.log(chalk.green("✓ Command completed successfully\n"));
          if (result.output) {
            console.log(chalk.dim("┌─ Output ─"));
            console.log(
              chalk.dim("│ ") + result.output.split("\n").join("\n│ ")
            );
            console.log(chalk.dim("└─\n"));
          }
        } else {
          console.log(chalk.red("✗ Command failed\n"));
          console.log(chalk.red("┌─ Error ─"));
          console.log(chalk.red("│ ") + result.error);
          console.log(chalk.red("└─\n"));
        }
      } catch (error) {
        spinner.stop();
        console.error(
          chalk.red.bold("\n✗ Fatal Error: ") +
            chalk.red(
              error instanceof Error ? error.message : "Unknown error"
            ) +
            "\n"
        );
        process.exit(1);
      }
    }
  );

// --- Chat (TUI) mode ---
program
  .command("chat")
  .description("Start interactive chat mode with T-AI")
  .option("-n, --new-conversation", "Start a new conversation")
  .action(async (options: { newConversation?: boolean }) => {
    try {
      displayBanner();

      console.log(chalk.dim("━".repeat(67)));
      console.log(chalk.green("  ✓ Chat mode activated"));
      console.log(chalk.dim("  • Type your message and press Enter"));
      console.log(
        chalk.dim("  • Type ") +
          chalk.cyan("'exit'") +
          chalk.dim(" or ") +
          chalk.cyan("'quit'") +
          chalk.dim(" to end session")
      );
      console.log(
        chalk.dim("  • Type ") +
          chalk.cyan("'clear'") +
          chalk.dim(" to clear conversation history")
      );
      console.log(
        chalk.dim("  • Type ") +
          chalk.cyan("'banner'") +
          chalk.dim(" to show banner again")
      );
      console.log(chalk.dim("━".repeat(67)) + "\n");

      await HistoryService.init();

      if (options.newConversation) {
        await HistoryService.clearHistory();
        console.log(chalk.green("✨ New conversation started\n"));
      }

      // Start the REPL loop
      while (true) {
        const userInput = readlineSync.question(
          chalk.bold.green("❯ ") + chalk.white("")
        );

        const trimmedInput = userInput.trim().toLowerCase();

        if (trimmedInput === "exit" || trimmedInput === "quit") {
          console.log(chalk.cyan("\n╭─────────────────────╮"));
          console.log(
            chalk.cyan("│") +
              chalk.bold("  Goodbye! 👋        ") +
              chalk.cyan("│")
          );
          console.log(chalk.cyan("╰─────────────────────╯\n"));
          process.exit(0);
        }

        if (trimmedInput === "clear") {
          await HistoryService.clearHistory();
          console.log(chalk.green("✨ History cleared\n"));
          continue;
        }

        if (trimmedInput === "banner") {
          displayBanner();
          continue;
        }

        if (userInput.trim() === "") {
          continue;
        }

        spinner.start("T-AI is thinking...");

        try {
          const aiResponse = await AIService.generateLlmResponse(userInput);
          spinner.stop();

          const formattedResponse = marked.parse(aiResponse) as string;

          console.log(chalk.bold.magenta("\n╭─ T-AI"));
          console.log(chalk.magenta("│"));

          // Add left border to each line
          const lines = formattedResponse.split("\n");
          lines.forEach((line) => {
            if (line.trim()) {
              console.log(chalk.magenta("│ ") + line);
            }
          });

          console.log(
            chalk.magenta("╰─") +
              chalk.dim(` ${new Date().toLocaleTimeString()}`)
          );
          console.log("");
        } catch (error) {
          spinner.stop();
          console.error(
            chalk.red("\n✗ Error: ") +
              chalk.red(
                error instanceof Error ? error.message : "Unknown error"
              ) +
              "\n"
          );
        }
      }
    } catch (error) {
      spinner.stop();
      console.error(
        chalk.red.bold("\n✗ Fatal Error: ") +
          chalk.red(error instanceof Error ? error.message : "Unknown error") +
          "\n"
      );
      process.exit(1);
    }
  });

// --- Clear history command ---
program
  .command("clear-history")
  .description("Clear conversation history")
  .action(async () => {
    await HistoryService.init();
    await HistoryService.clearHistory();
    console.log(chalk.green("✨ Conversation history cleared"));
  });

program.parse();
