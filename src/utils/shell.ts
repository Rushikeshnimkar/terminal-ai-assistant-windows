// src/utils/shell.ts

export type ShellType = "powershell" | "cmd" | "gitbash";

export function detectShell(): ShellType {
  // If running on Windows, check environment flags
  if (process.platform === "win32") {
    // PowerShell sets PSModulePath
    if (process.env.PSModulePath) {
      return "powershell";
    }
    // Git Bash sets BASH or SHELL environment variables containing bash
    if (process.env.BASH || (process.env.SHELL && process.env.SHELL.toLowerCase().includes("bash"))) {
      return "gitbash";
    }
    return "cmd";
  }
  
  // Non-Windows environments fallback to standard bash/sh equivalents
  return "gitbash";
}
