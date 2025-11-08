// services/aiService.ts

import chalk from "chalk";
import { HistoryService } from "./historyService.js";
import dotenv from "dotenv";
import path from "path";
import os from "os";

// Load environment variables (for user settings, NOT API keys)
dotenv.config({ path: path.join(os.homedir(), ".terminal-ai", ".env") });

interface AICommandResponse {
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
  // *****************************************************************
  // *** KEY CHANGE: ONLY ONE API URL, NO LOCAL API KEYS ***
  // *****************************************************************
  private static readonly API_URL = "https://terminal-ai-api.vercel.app/api";
  private static readonly CURRENT_DIR = process.cwd();

  // (Your ADMIN_COMMANDS and FILE_OPERATION_COMMANDS sets are fine)
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

  // (isPotentiallyDangerous is fine)
  static isPotentiallyDangerous(command: string): boolean {
    const commandLower = command.toLowerCase();
    if (
      Array.from(this.ADMIN_COMMANDS).some((adminCmd) =>
        commandLower.includes(adminCmd.toLowerCase())
      )
    ) {
      return true;
    }
    if (
      commandLower.startsWith("del ") ||
      commandLower.startsWith("rd ") ||
      commandLower.startsWith("rmdir ")
    ) {
      return true;
    }
    return false;
  }

  // (parseAICommandResponse is fine)
  private static parseAIResponse(responseText: string): AICommandResponse {
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No JSON object found in AI response.");
      }
      const parsed = JSON.parse(jsonMatch[0]);
      if (!parsed.command || !parsed.reasoning) {
        throw new Error("AI response missing 'command' or 'reasoning' field.");
      }
      const command = parsed.command
        .trim()
        .replace(/^`+cmd\n?|`+$/g, "")
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

  // *****************************************************************
  // *** generateCommand: SENDS "mode": "command" ***
  // *****************************************************************
  static async generateCommand(userInput: string): Promise<[string, string]> {
    try {
      if (!userInput?.trim()) {
        throw new Error("User input is required");
      }

      await HistoryService.init();
      // We no longer need createPrompt, the backend does it.
      // We just send the raw user input.

      const response = await fetch(this.API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: userInput, // Send raw user input
          mode: "command", // Tell the backend to use command mode
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API Error: ${errorText}`);
      }

      const data = await response.json();
      const aiRawText = data.choices[0]?.message?.content || "";

      // Parse the JSON response that the AI *text* contains
      const { reasoning, command } = this.parseAIResponse(aiRawText);

      await HistoryService.addMessage("user", userInput);
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

  // *****************************************************************
  // *** generateLlmResponse: SENDS "mode": "chat" ***
  // *****************************************************************
  static async generateLlmResponse(userInput: string): Promise<string> {
    try {
      if (!userInput?.trim()) {
        throw new Error("User input is required");
      }

      await HistoryService.init();

      const response = await fetch(this.API_URL, {
        // Use SAME Vercel API
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: userInput, // Send raw user input
          mode: "chat", // Tell the backend to use chat mode
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API Error (${response.status}): ${errorText}`);
      }

      const data = await response.json();
      const aiResponse =
        data.choices[0]?.message?.content || "Sorry, I had trouble thinking.";

      // Save to history
      await HistoryService.addMessage("user", userInput);
      await HistoryService.addMessage("assistant", aiResponse);

      return aiResponse;
    } catch (error) {
      throw new Error(
        `LLM response failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }
}
