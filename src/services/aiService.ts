// services/aiService.ts

import chalk from "chalk";
import { HistoryService } from "./historyService.js";
import dotenv from "dotenv";
import path from "path";
import os from "os";

// Load environment variables
dotenv.config({ path: path.join(os.homedir(), ".terminal-ai", ".env") });

interface AIResponse {
  reasoning: string;
  command: string;
}

class AIError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = "AIError";
  }
}

export class AIService {
  private static readonly API_URL = "https://terminal-ai-api.vercel.app/api";
  private static readonly CURRENT_DIR = process.cwd();

  // We keep these lists to check if we should warn the user
  private static readonly ADMIN_COMMANDS: Set<string> = new Set([
    "netsh",
    "net",
    "sc",
    "reg",
    "bcdedit",
    "diskpart",
    "dism",
    "sfc",
    "format",
    "chkdsk",
    "taskkill",
    "rd /s",
    "rmdir /s",
    "del /f",
    "takeown",
    "icacls",
    "attrib",
    "runas",
  ]);

  private static readonly FILE_OPERATION_COMMANDS: Set<string> = new Set([
    "mkdir",
    "touch",
    "echo",
    "cd",
    "copy",
    "xcopy",
    "md",
    "move",
    "type",
    "del",
    "rmdir",
    "rd",
    "ren",
    "rename",
  ]);

  // Public method to check if a command is potentially dangerous
  static isPotentiallyDangerous(command: string): boolean {
    const commandLower = command.toLowerCase();

    // Check for admin commands
    if (
      Array.from(this.ADMIN_COMMANDS).some((adminCmd) =>
        commandLower.includes(adminCmd.toLowerCase())
      )
    ) {
      return true;
    }

    // Check for file deletion commands
    if (
      commandLower.startsWith("del ") ||
      commandLower.startsWith("rd ") ||
      commandLower.startsWith("rmdir ")
    ) {
      return true;
    }

    return false;
  }

  private static async createPrompt(userInput: string): Promise<string> {
    const recentHistory = await HistoryService.getRecentHistory(5);
    const historyContext = recentHistory
      .map((msg) => `${msg.role}: ${msg.content}`)
      .join("\n");

    const systemInfo = {
      username: process.env.USERNAME || os.userInfo().username,
      hostname: os.hostname(),
      platform: os.platform(),
      osVersion: os.release(),
      currentDirectory: process.cwd(),
    };

    // Updated prompt to ask for JSON
    return `Task: Analyze the user's request, formulate a step-by-step reasoning plan, and then generate a single, valid Windows Command Prompt (CMD) command to accomplish it.

System Information:
Current directory: ${this.CURRENT_DIR}
Username: ${systemInfo.username}
OS: ${systemInfo.platform} ${systemInfo.osVersion}

${historyContext ? `Recent conversation:\n${historyContext}\n\n` : ""}

User request: ${userInput}

Requirements:
1.  **Reasoning:** First, provide a brief, step-by-step plan (as a string) explaining how you'll achieve the user's request.
2.  **Command:** Second, provide ONLY ONE single-line, executable CMD command. No PowerShell.
3.  **Safety:** Avoid destructive commands unless explicitly asked. Use relative paths.
4.  **Format:** Your response MUST be in this exact JSON format:
    {
      "reasoning": "Your step-by-step plan here.",
      "command": "Your single-line command here."
    }

Your JSON response:`;
  }

  private static parseAIResponse(responseText: string): AIResponse {
    try {
      // Find the JSON block, even if the AI adds text around it
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No JSON object found in AI response.");
      }

      const parsed = JSON.parse(jsonMatch[0]);

      if (!parsed.command || !parsed.reasoning) {
        throw new Error("AI response missing 'command' or 'reasoning' field.");
      }

      // Basic cleanup of the command
      const command = parsed.command
        .trim()
        .replace(/^`+cmd\n?|`+$/g, "") // Remove markdown fences
        .trim();

      return {
        reasoning: parsed.reasoning.trim(),
        command: command,
      };
    } catch (error) {
      console.error(
        chalk.red("Failed to parse AI response:"),
        error,
        "\nRaw response:",
        responseText
      );
      throw new AIError(
        "Invalid or empty response from AI. Try again.",
        "INVALID_RESPONSE"
      );
    }
  }

  static async generateCommand(userInput: string): Promise<[string, string]> {
    try {
      if (!userInput?.trim()) {
        throw new Error("User input is required");
      }

      // History service is now the single source of truth
      await HistoryService.init();
      const prompt = await this.createPrompt(userInput);

      // We don't need a conversationId, just send the full prompt
      const response = await fetch(this.API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: prompt, // We send our crafted prompt
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API Error: ${errorText}`);
      }

      const data = await response.json();
      const aiRawText = data.choices[0]?.message?.content || "";

      // Parse the JSON response
      const { reasoning, command } = this.parseAIResponse(aiRawText);

      // Save to history
      await HistoryService.addMessage("user", userInput);
      // Save the *command* as the assistant's response for context
      await HistoryService.addMessage("assistant", command);

      return [command, reasoning];
    } catch (error) {
      throw new Error(
        `Command generation failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }
}
