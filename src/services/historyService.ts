import fs from "fs-extra";
import path from "path";
import os from "os";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

export class HistoryService {
  private static readonly CONFIG_DIR = path.join(os.homedir(), ".terminal-ai");
  private static readonly HISTORY_FILE = path.join(
    this.CONFIG_DIR,
    "history.json"
  );
  private static history: Message[] = [];
  private static initialized = false;

  static async init(): Promise<void> {
    if (this.initialized) return;

    try {
      await fs.ensureDir(this.CONFIG_DIR);

      if (await fs.pathExists(this.HISTORY_FILE)) {
        this.history = await fs.readJson(this.HISTORY_FILE);
      }

      this.initialized = true;
    } catch (error) {
      console.error("Failed to initialize history:", error);
      this.history = [];
    }
  }

  static async addMessage(
    role: "user" | "assistant",
    content: string
  ): Promise<void> {
    await this.init();

    const message = {
      role,
      content,
      timestamp: Date.now(),
    };

    this.history.push(message);

    // Keep only last 20 messages
    if (this.history.length > 20) {
      this.history = this.history.slice(-20);
    }

    await this.saveHistory();
  }

  static async getRecentHistory(count: number = 5): Promise<Message[]> {
    await this.init();
    return this.history.slice(-count);
  }

  static async clearHistory(): Promise<void> {
    await this.init();
    this.history = [];
    await this.saveHistory();
  }

  private static async saveHistory(): Promise<void> {
    try {
      await fs.writeJson(this.HISTORY_FILE, this.history, { spaces: 2 });
    } catch (error) {
      console.error("Error saving history:", error);
    }
  }
}
