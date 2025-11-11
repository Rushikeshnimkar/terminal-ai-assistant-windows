// src/services/githubService.ts
import { Octokit } from "@octokit/rest";
import fs from "fs-extra";
import path from "path";
import os from "os";
import chalk from "chalk";

// Use the same Vercel API base as your aiService
const API_BASE_URL = "https://terminal-ai-api.vercel.app/api/github";
const CONFIG_DIR = path.join(os.homedir(), ".terminal-ai");
const TOKEN_FILE = path.join(CONFIG_DIR, "github.json");

// Helper function to wait
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class GithubService {
  private static octokit: Octokit | null = null;

  private static async saveToken(token: string): Promise<void> {
    await fs.ensureDir(CONFIG_DIR);
    await fs.writeJson(TOKEN_FILE, { token });
  }

  private static async loadToken(): Promise<string | null> {
    if (await fs.pathExists(TOKEN_FILE)) {
      const { token } = await fs.readJson(TOKEN_FILE);
      return token;
    }
    return null;
  }

  static async getOctokit(): Promise<Octokit> {
    if (this.octokit) return this.octokit;

    const token = await this.loadToken();
    if (token) {
      this.octokit = new Octokit({ auth: token });
      return this.octokit;
    }

    throw new Error("Not authenticated. Please run 't-ai github login'.");
  }

  // --- THIS IS THE CORRECTED LOGIN METHOD ---
  // --- THIS IS THE CORRECTED LOGIN METHOD ---
  static async login(): Promise<void> {
    let poller: NodeJS.Timeout | null = null;
    let loginTimeout: NodeJS.Timeout | null = null;

    try {
      // 1. Call backend to start auth flow
      const startResponse = await fetch(`${API_BASE_URL}/start-auth`, {
        method: "POST",
      });
      if (!startResponse.ok) {
        throw new Error(`Backend error: ${await startResponse.text()}`);
      }

      // ✅ **FIX 1: Get all new values from the server**
      const {
        user_code,
        verification_uri,
        interval,
        device_code, // <-- The secret code
        expires_in, // <-- The timeout in seconds
      } = await startResponse.json();

      console.log(
        chalk.yellow(`\nOpen this URL in your browser: ${verification_uri}`)
      );
      console.log(chalk.bold.white(`And enter this code: ${user_code}\n`));
      console.log(chalk.dim("Waiting for you to authorize..."));

      // ✅ **FIX 2: Add a master timeout for the whole process**
      // This will automatically fail after 'expires_in' seconds (e.g., 15 mins)
      const controller = new AbortController();
      loginTimeout = setTimeout(() => {
        controller.abort();
        console.log(chalk.red("\nLogin attempt timed out."));
      }, (expires_in + 5) * 1000); // Add 5s buffer

      // 2. Poll your backend to check for completion
      while (true) {
        await delay(interval * 1000); // Wait for the interval (e.g., 5s)

        // ✅ **FIX 3: Send the correct 'device_code'**
        const checkResponse = await fetch(
          `${API_BASE_URL}/check-auth?code=${device_code}`,
          { signal: controller.signal }
        );

        if (checkResponse.status === 200) {
          // Success!
          const { token } = await checkResponse.json();
          await this.saveToken(token);
          this.octokit = new Octokit({ auth: token });
          console.log(
            chalk.green("✅ Successfully authenticated with GitHub!")
          );
          return; // Exit the loop
        }

        if (checkResponse.status !== 202) {
          // 202 means "still pending"
          // Any other error means failure
          throw new Error("Authentication failed or expired.");
        }
        // else, it's 202: still pending, loop again
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        // This is our timeout
        console.error(chalk.red("\nLogin failed: Authentication timed out."));
      } else if (error instanceof Error) {
        // This is any other error (like the one you were seeing)
        console.error(chalk.red(`\nLogin failed: ${error.message}\n`));
      } else {
        // Unknown error type (not an instance of Error)
        console.error(chalk.red("\nLogin failed: An unknown error occurred.\n"));
      }
    } finally {
      // Clear any pending timeouts
      if (poller) clearInterval(poller);
      if (loginTimeout) clearTimeout(loginTimeout);
    }
  }
  // --- END OF CORRECTED METHOD ---

  // These methods are now safe to use, as they rely on the token
  // that was securely obtained.
  static async createRemoteRepo(
    name: string,
    isPrivate: boolean
  ): Promise<string> {
    const octokit = await this.getOctokit();
    const { data } = await octokit.repos.createForAuthenticatedUser({
      name,
      private: isPrivate,
    });
    return data.clone_url; // Returns the HTTPS clone URL
  }

  static async listRepos(): Promise<string[]> {
    const octokit = await this.getOctokit();
    const { data } = await octokit.repos.listForAuthenticatedUser();
    return data.map((repo) => repo.full_name);
  }
}
