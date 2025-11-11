// services/commandService.ts

import { spawn } from "child_process";
import { CommandResult } from "../types/index.js";

export const executeCommand = async (
  command: string
): Promise<CommandResult> => {
  return new Promise((resolve) => {
    // Use cmd.exe /c to execute the command string in the Windows shell
    // stdio: 'inherit' streams stdout, stderr, and stdin in real-time
    const child = spawn("cmd.exe", ["/c", command], {
      stdio: "inherit",
    });

    child.on("close", (code) => {
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
      // This catches errors like 'command not found'
      resolve({
        success: false,
        output: "",
        error: err.message,
      });
    });
  });
};

// --- ADD THIS NEW FUNCTION ---
// This version runs a command silently and returns the output
export const getCommandOutput = async (command: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const [cmd, ...args] = command.split(" ");
    const child = spawn(cmd, args, { shell: true }); // Use shell for safety
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (data) => (stdout += data.toString()));
    child.stderr.on("data", (data) => (stderr += data.toString()));

    child.on("close", (code) => {
      if (code === 0) {
        resolve(stdout.trim());
      } else {
        reject(stderr.trim());
      }
    });
    child.on("error", (err) => reject(err.message));
  });
};
