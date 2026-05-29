// services/aiService.ts

import crypto from "crypto";
import chalk from "chalk";
import { HistoryService } from "./historyService.js";
import dotenv from "dotenv";
import path from "path";
import os from "os";
// --- NEW ---
// We will need the getCommandOutput function for the Git-Aware feature
import { getCommandOutput } from "./commandService.js";
import { FileSystemService } from "./fileSystemService.js";
import { detectShell } from "../utils/shell.js";

// Load environment variables (for user settings, NOT API keys)
dotenv.config({ path: path.join(os.homedir(), ".terminal-ai", ".env") });

interface AICommandResponse {
  reasoning: string;
  command: string;
}

// --- NEW: Type for our new function's payload ---
interface ApiPayload {
  prompt: string;
  mode: "command" | "chat" | "fix";
  history?: Array<{ role: "user" | "assistant"; content: string }>;
  conversationId?: string;
  shell?: string;
  failedCommand?: string;
  errorOutput?: string;
  originalQuery?: string;
}

// --- NEW: Type for the Vercel API response ---
// Based on the code in your API file
interface ApiResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
  conversationId: string;
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

  // (ADMIN_COMMANDS and FILE_OPERATION_COMMANDS sets remain unchanged)
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

  // (isPotentiallyDangerous remains unchanged)
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

  // (parseAIResponse remains unchanged)
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

  // --- NEW: Helper to get Git context (from our previous discussion) ---
  private static async getGitContext(): Promise<string> {
    try {
      const inGitRepo = await FileSystemService.directoryExists(".git");
      if (!inGitRepo) return "";

      const [status, branch, remote] = await Promise.all([
        getCommandOutput("git status --porcelain").catch(() => ""),
        getCommandOutput("git rev-parse --abbrev-ref HEAD").catch(() => ""),
        getCommandOutput("git remote -v").catch(() => ""),
      ]);

      let context = "\n\n--- Git Context ---\n";
      context += `Current Branch: ${branch || "unknown"}\n`;
      if (status) {
        context += `Status (porcelain):\n${status}\n`;
      } else {
        context += "Status: Clean\n";
      }
      if (remote) {
        context += `Remotes:\n${remote}\n`;
      }
      context += "--- End Git Context ---\n";
      return context;
    } catch (error) {
      return ""; // Fail silently
    }
  }

  private static getHandshakeHeaders(): Record<string, string> {
    const timestamp = Math.floor(Date.now() / 30000); // 30-second window
    const SALT_PARTS = ["tai", "terminal", "assistant", "super", "secret", "salt", "2026"];
    const secret = SALT_PARTS.join("-");
    
    const hmac = crypto.createHmac("sha256", secret);
    hmac.update(String(timestamp));
    const signature = hmac.digest("hex");

    return {
      "X-T-AI-Signature": signature,
      "X-T-AI-Timestamp": String(timestamp),
    };
  }

  // --- NEW: Refactored private callAPI method (as per your suggestion) ---
  private static async callAPI(payload: ApiPayload): Promise<ApiResponse> {
    const handshakeHeaders = this.getHandshakeHeaders();
    const response = await fetch(this.API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...handshakeHeaders,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API Error (${response.status}): ${errorText}`);
    }

    return response.json();
  }

  // --- UPDATED: generateCommand ---
  static async generateCommand(userInput: string): Promise<[string, string]> {
    try {
      if (!userInput?.trim()) {
        throw new Error("User input is required");
      }

      await HistoryService.init();

      // Get Git context
      const gitContext = await this.getGitContext();
      const promptWithContext = userInput + gitContext;

      // Get recent history
      const recentHistory = await HistoryService.getRecentHistory(10);
      const formattedHistory = recentHistory.map((h) => ({
        role: h.role,
        content: h.content,
      }));

      // Call the new refactored method
      const data = await this.callAPI({
        prompt: promptWithContext,
        mode: "command",
        history: formattedHistory,
        shell: detectShell(),
      });

      const aiRawText = data.choices[0]?.message?.content || "";

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

  // --- UPDATED: generateLlmResponse ---
  static async generateLlmResponse(userInput: string): Promise<string> {
    try {
      if (!userInput?.trim()) {
        throw new Error("User input is required");
      }

      await HistoryService.init();

      // Get Git context
      const gitContext = await this.getGitContext();
      const promptWithContext = userInput + gitContext;

      // Get recent history
      const recentHistory = await HistoryService.getRecentHistory(10);
      const formattedHistory = recentHistory.map((h) => ({
        role: h.role,
        content: h.content,
      }));

      // Call the new refactored method
      const data = await this.callAPI({
        prompt: promptWithContext,
        mode: "chat",
        history: formattedHistory,
      });

      const aiResponse =
        data.choices[0]?.message?.content || "Sorry, I had trouble thinking.";

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

  // --- NEW: generateLlmResponseStream ---
  static async generateLlmResponseStream(
    userInput: string,
    onChunk: (text: string) => void
  ): Promise<string> {
    try {
      if (!userInput?.trim()) {
        throw new Error("User input is required");
      }

      await HistoryService.init();

      // Get Git context
      const gitContext = await this.getGitContext();
      const promptWithContext = userInput + gitContext;

      // Get recent history
      const recentHistory = await HistoryService.getRecentHistory(10);
      const formattedHistory = recentHistory.map((h) => ({
        role: h.role,
        content: h.content,
      }));

      const handshakeHeaders = this.getHandshakeHeaders();
      // Call Vercel API via fetch directly to consume the readable stream
      const response = await fetch(this.API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...handshakeHeaders,
        },
        body: JSON.stringify({
          prompt: promptWithContext,
          mode: "chat",
          history: formattedHistory,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API Error (${response.status}): ${errorText}`);
      }

      const reader = response.body;
      if (!reader) {
        throw new Error("No readable stream in response body");
      }

      let fullResponse = "";
      const decoder = new TextDecoder();

      const streamReader = reader.getReader();
      while (true) {
        const { done, value } = await streamReader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          const cleaned = line.trim();
          if (cleaned.startsWith("data: ")) {
            const dataStr = cleaned.slice(6).trim();
            if (dataStr === "[DONE]") continue;

            try {
              const parsed = JSON.parse(dataStr);
              const delta = parsed.choices?.[0]?.delta?.content || "";
              if (delta) {
                fullResponse += delta;
                onChunk(delta);
              }
            } catch (err) {
              // Ignore split JSON chunks errors
            }
          }
        }
      }

      // Add to history
      await HistoryService.addMessage("user", userInput);
      await HistoryService.addMessage("assistant", fullResponse);

      return fullResponse;
    } catch (error) {
      throw new Error(
        `LLM streaming response failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  // --- NEW: generateFixCommand ---
  static async generateFixCommand(
    originalQuery: string,
    failedCommand: string,
    errorOutput: string
  ): Promise<[string, string]> {
    try {
      const data = await this.callAPI({
        prompt: originalQuery,
        mode: "fix",
        shell: detectShell(),
        failedCommand,
        errorOutput,
        originalQuery,
      });

      const aiRawText = data.choices[0]?.message?.content || "";
      const { reasoning, command } = this.parseAIResponse(aiRawText);
      return [command, reasoning];
    } catch (error) {
      throw new Error(
        `Command correction failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }
}
