/**
 * Standalone Adapter
 * Uses built-in Playwright library - always available as fallback
 */

import { chromium, type Browser, type Page, type BrowserContext } from 'playwright';
import { BaseAdapter } from './base.js';
import type { AdapterName, ScrapeOptions, ScrapeResult, SearchOptions, SearchResult } from '../types/adapters.js';
import { loadConfig } from '../types/config.js';
import { FacebookParser } from '../parsers/facebook-parser.js';

export class StandaloneAdapter extends BaseAdapter {
  name: AdapterName = 'standalone';
  private parser = new FacebookParser();
  private browser: Browser | null = null;

  async isAvailable(): Promise<boolean> {
    // Always available
    return true;
  }

  private async getBrowser(): Promise<Browser> {
    if (!this.browser) {
      const config = loadConfig();
      this.browser = await chromium.launch({
        headless: config.headless,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-blink-features=AutomationControlled'
        ]
      });
    }
    return this.browser;
  }

  private async createStealthContext(): Promise<BrowserContext> {
    const browser = await this.getBrowser();
    const config = loadConfig();

    const context = await browser.newContext({
      viewport: config.viewport,
      userAgent: config.user_agent,
      locale: 'en-US',
      timezoneId: 'America/New_York',
      permissions: [],
      javaScriptEnabled: true
    });

    // Add stealth scripts
    await context.addInitScript(() => {
      // Hide webdriver
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined
      });

      // Mock plugins
      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5]
      });

      // Mock languages
      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en']
      });

      // Hide automation
      (window as unknown as { chrome?: object }).chrome = { runtime: {} };
    });

    return context;
  }

  private async bypassLoginModal(page: Page): Promise<void> {
    try {
      // Wait a bit for modal to appear
      await page.waitForTimeout(2000);

      // Try pressing Escape
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);

      // Try clicking outside modal
      await page.mouse.click(10, 10);
      await page.waitForTimeout(500);

      // Try closing any visible close buttons
      const closeButtons = await page.$$('[aria-label="Close"], [data-testid="close"]');
      for (const btn of closeButtons) {
        try {
          await btn.click();
          await page.waitForTimeout(300);
        } catch {
          // Ignore click errors
        }
      }
    } catch {
      // Ignore errors - modal might not exist
    }
  }

  private buildFacebookUrl(url: string): string {
    const config = loadConfig();
    
    // Convert to mbasic if enabled (less anti-bot)
    if (config.use_mbasic && url.includes('facebook.com') && !url.includes('mbasic.')) {
      return url.replace('www.facebook.com', 'mbasic.facebook.com')
                .replace('facebook.com', 'mbasic.facebook.com')
                .replace('m.facebook.com', 'mbasic.facebook.com');
    }
    
    return url;
  }

  async scrapeUrl(url: string, options?: ScrapeOptions): Promise<ScrapeResult> {
    const startTime = Date.now();
    let context: BrowserContext | null = null;

    try {
      const targetUrl = this.buildFacebookUrl(url);
      context = await this.createStealthContext();
      const page = await context.newPage();

      // Navigate to page
      await page.goto(targetUrl, { 
        waitUntil: 'domcontentloaded',
        timeout: options?.timeout || 30000
      });

      // Bypass login modal
      await this.bypassLoginModal(page);

      // Random delay to seem human
      await this.randomDelay();

      // Scroll to load more content
      await page.evaluate(() => {
        window.scrollBy(0, 500);
      });
      await page.waitForTimeout(1000);

      // Get HTML content
      const html = await page.content();

      // Parse posts
      const posts = this.parser.parsePosts(html);

      // Apply limit
      const limitedPosts = posts.slice(0, options?.limit || 20);

      return {
        success: true,
        data: limitedPosts,
        adapter_used: this.name,
        metadata: {
          scrape_time_ms: Date.now() - startTime,
          url: targetUrl,
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      return this.createErrorResult(error);
    } finally {
      if (context) {
        await context.close();
      }
    }
  }

  async search(query: string, options?: SearchOptions): Promise<SearchResult> {
    const startTime = Date.now();
    const searchType = options?.type || 'posts';
    let context: BrowserContext | null = null;

    try {
      context = await this.createStealthContext();
      const page = await context.newPage();

      // Build search URL
      const searchUrl = `https://mbasic.facebook.com/search/${searchType}/?q=${encodeURIComponent(query)}`;

      await page.goto(searchUrl, {
        waitUntil: 'domcontentloaded',
        timeout: options?.timeout || 30000
      });

      await this.bypassLoginModal(page);
      await this.randomDelay();

      const html = await page.content();
      const items = this.parser.parsePosts(html);

      return {
        success: true,
        data: {
          type: searchType,
          items: items.slice(0, options?.limit || 10),
          total_count: items.length,
          has_more: items.length > (options?.limit || 10)
        },
        adapter_used: this.name,
        metadata: {
          search_time_ms: Date.now() - startTime,
          query,
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      return this.createSearchErrorResult(error);
    } finally {
      if (context) {
        await context.close();
      }
    }
  }

  async cleanup(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}
