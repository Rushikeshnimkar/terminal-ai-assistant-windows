// src/services/githubService.ts

import { Octokit } from "@octokit/rest";
import fs from "fs-extra";
import path from "path";
import os from "os";
import chalk from "chalk";
// --- NEW IMPORTS ---
import crypto from "crypto";

// Use the same Vercel API base as your aiService
const API_BASE_URL = "https://terminal-ai-api.vercel.app/api/github";
const CONFIG_DIR = path.join(os.homedir(), ".terminal-ai");
// --- NEW: Encrypted token file ---
const TOKEN_FILE = path.join(CONFIG_DIR, "github.token.enc");

// --- NEW: Encryption Constants (as per your suggestion) ---
const ALGORITHM = "aes-256-gcm";
const SALT = "t-ai-github-salt"; // A unique salt for this specific purpose

// Helper function to wait
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// --- NEW: Secure key generation (as per your suggestion) ---
/**
 * Generates a stable, machine-specific 32-byte key
 * from the user's OS username and our salt.
 */
const getEncryptionKey = (): Buffer => {
  return crypto.scryptSync(os.userInfo().username, SALT, 32);
};

// --- NEW: Encryption function ---
/**
 * Encrypts a plaintext string.
 * @param text The plaintext token to encrypt.
 * @returns A stringified JSON object containing iv, authTag, and content.
 */
const encrypt = (text: string): string => {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(16); // Initialization Vector
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag().toString("hex");

  // Store all parts needed for decryption
  const encryptedData = {
    iv: iv.toString("hex"),
    authTag: authTag,
    content: encrypted,
  };

  return JSON.stringify(encryptedData);
};

// --- NEW: Decryption function ---
/**
 * Decrypts a stored JSON string back to plaintext.
 * @param encryptedDataString The stringified JSON object from the file.
 * @returns The decrypted plaintext token, or null if decryption fails.
 */
const decrypt = (encryptedDataString: string): string | null => {
  try {
    const key = getEncryptionKey();
    const encryptedData = JSON.parse(encryptedDataString);

    const iv = Buffer.from(encryptedData.iv, "hex");
    const authTag = Buffer.from(encryptedData.authTag, "hex");

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedData.content, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  } catch (error) {
    console.error(
      chalk.red(
        "Failed to decrypt token. It may be corrupt or from a different user."
      )
    );
    return null;
  }
};

export class GithubService {
  private static octokit: Octokit | null = null;

  // --- UPDATED: saveToken ---
  private static async saveToken(token: string): Promise<void> {
    await fs.ensureDir(CONFIG_DIR);
    // Encrypt the token before saving
    const encryptedToken = encrypt(token);
    await fs.writeFile(TOKEN_FILE, encryptedToken, "utf8");
  }

  // --- UPDATED: loadToken ---
  private static async loadToken(): Promise<string | null> {
    if (await fs.pathExists(TOKEN_FILE)) {
      // Read the encrypted file
      const encryptedDataString = await fs.readFile(TOKEN_FILE, "utf8");
      if (!encryptedDataString) {
        return null;
      }
      // Decrypt and return the token
      return decrypt(encryptedDataString);
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

  // --- (login method is unchanged) ---
  static async login(): Promise<void> {
    let poller: NodeJS.Timeout | null = null;
    let loginTimeout: NodeJS.Timeout | null = null;

    try {
      const startResponse = await fetch(`${API_BASE_URL}/start-auth`, {
        method: "POST",
      });
      if (!startResponse.ok) {
        throw new Error(`Backend error: ${await startResponse.text()}`);
      }

      const { user_code, verification_uri, interval, device_code, expires_in } =
        await startResponse.json();

      console.log(
        chalk.yellow(`\nOpen this URL in your browser: ${verification_uri}`)
      );
      console.log(chalk.bold.white(`And enter this code: ${user_code}\n`));
      console.log(chalk.dim("Waiting for you to authorize..."));

      const controller = new AbortController();
      loginTimeout = setTimeout(() => {
        controller.abort();
      }, (expires_in + 5) * 1000);

      while (true) {
        await delay(interval * 1000);

        const checkResponse = await fetch(
          `${API_BASE_URL}/check-auth?code=${device_code}`,
          { signal: controller.signal }
        );

        if (checkResponse.status === 200) {
          const { token } = await checkResponse.json();
          await this.saveToken(token); // This will now encrypt
          this.octokit = new Octokit({ auth: token });
          console.log(
            chalk.green("✅ Successfully authenticated with GitHub!")
          );
          return;
        }

        if (checkResponse.status !== 202) {
          throw new Error("Authentication failed or expired.");
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        console.error(chalk.red("\nLogin failed: Authentication timed out."));
      } else {
        if (error instanceof Error) {
          console.error(chalk.red(`\nLogin failed: ${error.message}\n`));
        } else {
          console.error(chalk.red(`\nLogin failed: Unknown error.\n`));
        }
      }
    } finally {
      if (poller) clearInterval(poller);
      if (loginTimeout) clearTimeout(loginTimeout);
    }
  }

  // --- (createRemoteRepo and listRepos methods are unchanged) ---
  static async createRemoteRepo(
    name: string,
    isPrivate: boolean
  ): Promise<string> {
    const octokit = await this.getOctokit();
    const { data } = await octokit.repos.createForAuthenticatedUser({
      name,
      private: isPrivate,
    });
    return data.clone_url;
  }

  static async listRepos(): Promise<string[]> {
    const octokit = await this.getOctokit();
    const { data } = await octokit.repos.listForAuthenticatedUser();
    return data.map((repo) => repo.full_name);
  }
}
