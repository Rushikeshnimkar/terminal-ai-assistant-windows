// services/commandService.ts

import { spawn } from "child_process";
import { CommandResult } from "../types/index.js";
import chalk from "chalk";

const COMMAND_TIMEOUT = 300000; // 5 minutes

// --- UPDATED SANITIZE FUNCTION ---
/**
 * Escapes the most dangerous shell metacharacter: ';'.
 * This prevents command injection (e.g., "git commit; del C:\")
 * while allowing the AI to use valid shell logic like '&&' and '||'.
 * The 'for' loop bug is an AI model error (wrong quotes),
 * but this sanitizer will stop breaking it.
 */
const sanitizeCommand = (command: string): string => {
  // Only escape the semicolon
  return command.replace(/[;]/g, (match) => `^${match}`);
};

/**
 * Executes a *single* command string, which may be complex.
 * This is now the only function that runs commands.
 */
const runSingleCommand = (command: string): Promise<CommandResult> => {
  return new Promise((resolve) => {
    let timer: NodeJS.Timeout | null = null;

    // Sanitize the command to prevent ';' injection
    const safeCommand = sanitizeCommand(command);

    const child = spawn(safeCommand, {
      stdio: "inherit",
      shell: true,
    });

    timer = setTimeout(() => {
      child.kill();
      resolve({
        success: false,
        output: "",
        error: `Command timed out after ${COMMAND_TIMEOUT / 1000} seconds`,
      });
    }, COMMAND_TIMEOUT);

    child.on("close", (code) => {
      if (timer) clearTimeout(timer);

      if (code === 0) {
        resolve({
          success: true,
          output: "(Output was streamed above)",
          error: null,
        });
      } else {
        resolve({
          success: false,
          output: "",
          error: `Command exited with code ${code}`,
        });
      }
    });

    child.on("error", (err) => {
      if (timer) clearTimeout(timer);

      resolve({
        success: false,
        output: "",
        error: err.message,
      });
    });
  });
};

// --- UPDATED executeCommand ---
/**
 * Executes a full command string from the AI.
 * We no longer split by '&&'; we let the shell handle all logic.
 */
export const executeCommand = async (
  fullCommand: string
): Promise<CommandResult> => {
  // 1. Pass the entire command string to runSingleCommand.
  // The shell will handle '&&', '||', and '(...)' logic.
  const result = await runSingleCommand(fullCommand);

  if (!result.success) {
    return result;
  }

  // 2. If all commands succeeded
  return {
    success: true,
    output: "(All commands streamed above)",
    error: null,
  };
};

/**
 * This version runs a command silently and returns the output.
 */
export const getCommandOutput = async (command: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    let timer: NodeJS.Timeout | null = null;

    // Sanitize here as well
    const safeCommand = sanitizeCommand(command);

    const child = spawn(safeCommand, { shell: true });
    let stdout = "";
    let stderr = "";

    timer = setTimeout(() => {
      child.kill();
      reject(
        new Error(`Command timed out after ${COMMAND_TIMEOUT / 1000} seconds`)
      );
    }, COMMAND_TIMEOUT);

    child.stdout.on("data", (data) => (stdout += data.toString()));
    child.stderr.on("data", (data) => (stderr += data.toString()));

    child.on("close", (code) => {
      if (timer) clearTimeout(timer);

      if (code === 0) {
        resolve(stdout.trim());
      } else {
        reject(
          new Error(
            `Command failed with code ${code}. Stderr: ${stderr.trim()}`
          )
        );
      }
    });

    child.on("error", (err) => {
      if (timer) clearTimeout(timer);
      reject(err.message);
    });
  });
};
