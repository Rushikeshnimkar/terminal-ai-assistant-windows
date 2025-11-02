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
