import fs from "fs-extra";
import path from "path";
import os from "os";

export class FileSystemService {
  /**
   * Checks if a directory exists at the specified path
   */
  static async directoryExists(dirPath: string): Promise<boolean> {
    try {
      const stats = await fs.stat(dirPath);
      return stats.isDirectory();
    } catch (error) {
      return false;
    }
  }

  /**
   * Checks if a file exists at the specified path
   */
  static async fileExists(filePath: string): Promise<boolean> {
    try {
      const stats = await fs.stat(filePath);
      return stats.isFile();
    } catch (error) {
      return false;
    }
  }

  /**
   * Creates a directory if it doesn't exist
   */
  static async ensureDirectory(dirPath: string): Promise<void> {
    await fs.ensureDir(dirPath);
  }

  /**
   * Creates a file with the specified content
   */
  static async createFile(filePath: string, content: string): Promise<void> {
    await fs.writeFile(filePath, content);
  }

  /**
   * Resolves a path, handling user home directory (~) and environment variables
   */
  static resolvePath(inputPath: string): string {
    // Handle home directory
    if (inputPath.startsWith("~")) {
      inputPath = path.join(os.homedir(), inputPath.substring(1));
    }

    // Handle environment variables
    inputPath = inputPath.replace(/%([^%]+)%/g, (_, varName) => {
      return process.env[varName] || "";
    });

    return path.resolve(inputPath);
  }

  /**
   * Lists files and directories in the specified path
   */
  static async listDirectory(
    dirPath: string
  ): Promise<{ files: string[]; directories: string[] }> {
    try {
      const items = await fs.readdir(dirPath);
      const result = { files: [] as string[], directories: [] as string[] };

      for (const item of items) {
        const itemPath = path.join(dirPath, item);
        const stats = await fs.stat(itemPath);

        if (stats.isDirectory()) {
          result.directories.push(item);
        } else if (stats.isFile()) {
          result.files.push(item);
        }
      }

      return result;
    } catch (error) {
      throw new Error(
        `Failed to list directory: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Validates if the path is potentially dangerous
   */
  static isPathSafe(pathToCheck: string): boolean {
    const systemPaths = [
      path.join(os.homedir(), ".."),
      "C:\\Windows",
      "C:\\Program Files",
      "C:\\Program Files (x86)",
      "C:\\ProgramData",
      "/bin",
      "/sbin",
      "/usr/bin",
      "/usr/sbin",
      "/etc",
      "/var",
    ];

    const resolvedPath = path.resolve(pathToCheck);

    return !systemPaths.some((systemPath) =>
      resolvedPath.startsWith(path.resolve(systemPath))
    );
  }
}
