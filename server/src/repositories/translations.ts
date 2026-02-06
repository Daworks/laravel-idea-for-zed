import { Connection } from "vscode-languageserver";
import * as fs from "fs";
import * as path from "path";
import { TranslationInfo } from "../types";
import { BoundedCache } from "../support/cache";

/**
 * Repository for collecting Laravel translation keys.
 * Scans lang/ directory (Laravel 9+) or resources/lang/ (older versions)
 * for both PHP array files and JSON translation files.
 */
export class TranslationRepository {
  private translations: TranslationInfo[] = [];
  private translationsByKey: Map<string, TranslationInfo> = new Map();
  private cache: BoundedCache<TranslationInfo[]>;

  constructor(
    private projectPath: string,
    private connection: Connection
  ) {
    this.cache = new BoundedCache<TranslationInfo[]>(10, 10 * 60 * 1000);
  }

  async load(): Promise<void> {
    const cached = this.cache.get("translations");
    if (cached) {
      this.setTranslations(cached);
      return;
    }

    try {
      const translations: TranslationInfo[] = [];

      // Find lang directory (Laravel 9+ uses lang/, older uses resources/lang/)
      const langDirs = [
        path.join(this.projectPath, "lang"),
        path.join(this.projectPath, "resources", "lang"),
      ];

      const langDir = langDirs.find((d) => fs.existsSync(d));
      if (!langDir) {
        this.connection.console.log(`[Translations] No lang directory found`);
        return;
      }

      const entries = fs.readdirSync(langDir, { withFileTypes: true });

      for (const entry of entries) {
        const entryPath = path.join(langDir, entry.name);

        if (entry.isDirectory()) {
          // Locale directory: lang/en/messages.php
          translations.push(
            ...this.scanLocaleDirectory(entryPath, entry.name)
          );
        } else if (entry.name.endsWith(".json")) {
          // JSON translation file: lang/en.json
          const locale = entry.name.replace(".json", "");
          translations.push(
            ...this.loadJsonTranslations(entryPath, locale)
          );
        }
      }

      this.setTranslations(translations);
      this.cache.set("translations", translations);
      this.connection.console.log(
        `[Translations] Loaded ${translations.length} translation keys`
      );
    } catch (e) {
      this.connection.console.log(`[Translations] Failed to load: ${e}`);
    }
  }

  async reload(): Promise<void> {
    this.cache.clear();
    await this.load();
  }

  findByKey(key: string): TranslationInfo | undefined {
    return this.translationsByKey.get(key);
  }

  search(query: string): TranslationInfo[] {
    if (!query) return this.translations;
    const lower = query.toLowerCase();
    return this.translations.filter((t) =>
      t.key.toLowerCase().includes(lower)
    );
  }

  getAll(): TranslationInfo[] {
    return this.translations;
  }

  count(): number {
    return this.translations.length;
  }

  private setTranslations(translations: TranslationInfo[]): void {
    this.translations = translations;
    this.translationsByKey.clear();
    for (const t of translations) {
      if (!this.translationsByKey.has(t.key)) {
        this.translationsByKey.set(t.key, t);
      }
    }
  }

  /**
   * Scan a locale directory for PHP translation files.
   * lang/en/messages.php → keys like "messages.welcome"
   */
  private scanLocaleDirectory(
    dir: string,
    locale: string
  ): TranslationInfo[] {
    const translations: TranslationInfo[] = [];

    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return translations;
    }

    for (const entry of entries) {
      if (!entry.name.endsWith(".php")) continue;

      const filePath = path.join(dir, entry.name);
      const group = entry.name.replace(".php", "");

      const keys = this.extractPhpArrayKeys(filePath, group);
      for (const key of keys) {
        translations.push({
          key,
          value: "",
          locale,
          file: filePath,
        });
      }
    }

    return translations;
  }

  /**
   * Load JSON translation file.
   * lang/en.json contains flat key-value pairs.
   */
  private loadJsonTranslations(
    filePath: string,
    locale: string
  ): TranslationInfo[] {
    try {
      const content = fs.readFileSync(filePath, "utf-8");
      const data = JSON.parse(content);
      const translations: TranslationInfo[] = [];

      for (const [key, value] of Object.entries(data)) {
        translations.push({
          key,
          value: typeof value === "string" ? value : JSON.stringify(value),
          locale,
          file: filePath,
        });
      }

      return translations;
    } catch {
      return [];
    }
  }

  /**
   * Extract translation keys from PHP array files using regex.
   * Matches patterns like: 'key' => 'value' or "key" => "value"
   */
  private extractPhpArrayKeys(filePath: string, group: string): string[] {
    try {
      const content = fs.readFileSync(filePath, "utf-8");
      const keys: string[] = [];

      const matches = Array.from(
        content.matchAll(/['"]([^'"]+)['"]\s*=>/g)
      );
      for (const m of matches) {
        keys.push(`${group}.${m[1]}`);
      }

      return keys;
    } catch {
      return [];
    }
  }
}
