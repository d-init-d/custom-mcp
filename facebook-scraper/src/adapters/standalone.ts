/**
 * Standalone Adapter
 * Uses built-in Playwright library - always available as fallback
 * Enhanced with retry, rate limiting, and caching
 */

import { chromium, type Browser, type BrowserContext } from 'playwright';
import { BaseAdapter } from './base.js';
import type { AdapterName, ScrapeOptions, ScrapeResult, SearchOptions, SearchResult } from '../types/adapters.js';
import { toSingularType } from '../types/adapters.js';
import { loadConfig } from '../types/config.js';
import { FacebookParser } from '../parsers/facebook-parser.js';
import { withRetry } from '../utils/retry.js';
import { facebookRateLimiter } from '../utils/rate-limiter.js';
import { scrapeCache, searchCache, Cache } from '../utils/cache.js';

export class StandaloneAdapter extends BaseAdapter {
  name: AdapterName = 'standalone';
  private parser = new FacebookParser();
  private browser: Browser | null = null;

  async isAvailable(): Promise<boolean> {
    // Always available as fallback
    return true;
  }

  private async getBrowser(): Promise<Browser> {
    if (!this.browser) {
      const config = loadConfig();
      console.error('[Standalone] Launching browser...');
      
      this.browser = await chromium.launch({
        headless: config.headless,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-blink-features=AutomationControlled',
          '--disable-web-security',
          '--disable-features=IsolateOrigins,site-per-process'
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
      javaScriptEnabled: true,
      ignoreHTTPSErrors: true,
      extraHTTPHeaders: {
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'DNT': '1',
        'Upgrade-Insecure-Requests': '1'
      }
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (globalThis as any).chrome = { runtime: {} };

      // Override permissions
      const originalQuery = window.navigator.permissions.query;
      window.navigator.permissions.query = (parameters: any) => (
        parameters.name === 'notifications' ?
          Promise.resolve({ state: 'denied', onchange: null } as PermissionStatus) :
          originalQuery(parameters)
      );
    });

    return context;
  }

  private buildFacebookUrl(url: string): string {
    const config = loadConfig();
    
    // Convert to mbasic if enabled (less anti-bot protection)
    if (config.use_mbasic && url.includes('facebook.com') && !url.includes('mbasic.')) {
      return url.replace('www.facebook.com', 'mbasic.facebook.com')
                .replace('facebook.com', 'mbasic.facebook.com')
                .replace('m.facebook.com', 'mbasic.facebook.com');
    }
    
    return url;
  }

  private async closeContext(context: BrowserContext | null): Promise<void> {
    if (context) {
      try {
        await context.close();
      } catch {
        // Ignore cleanup errors
      }
    }
  }

  private async scrapeWithContext(targetUrl: string, options?: ScrapeOptions): Promise<string> {
    const context = await this.createStealthContext();
    
    try {
      const page = await context.newPage();

      // Navigate to page
      await page.goto(targetUrl, { 
        waitUntil: 'domcontentloaded',
        timeout: options?.timeout || 30000
      });

      // Wait for content
      await page.waitForTimeout(2000);

      // Try pressing Escape to dismiss modals
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);

      // Click outside to dismiss any overlays
      await page.mouse.click(10, 10);
      await page.waitForTimeout(500);

      // Try to find and click close buttons
      try {
        const closeButtons = await page.$$('[aria-label="Close"], [data-testid="close"], [role="button"][aria-label*="close" i]');
        for (const btn of closeButtons) {
          try {
            await btn.click({ timeout: 500 });
            await page.waitForTimeout(300);
          } catch {
            // Ignore click errors
          }
        }
      } catch {
        // Ignore
      }

      // Random delay to seem human
      await this.randomDelay();

      // Scroll to load more content
      await page.evaluate(() => {
        scrollBy(0, 500);
      });
      await page.waitForTimeout(1000);

      // Get HTML content
      return await page.content();
    } finally {
      await this.closeContext(context);
    }
  }

  private async searchWithContext(searchUrl: string, options?: SearchOptions): Promise<string> {
    const context = await this.createStealthContext();
    
    try {
      const page = await context.newPage();

      await page.goto(searchUrl, {
        waitUntil: 'domcontentloaded',
        timeout: options?.timeout || 30000
      });

      await page.waitForTimeout(2000);
      await page.keyboard.press('Escape');
      await this.randomDelay();

      return await page.content();
    } finally {
      await this.closeContext(context);
    }
  }

  async scrapeUrl(url: string, options?: ScrapeOptions): Promise<ScrapeResult> {
    const startTime = Date.now();

    // Check cache first
    const cacheKey = Cache.generateKey(url, options);
    const cached = scrapeCache.get(cacheKey);
    if (cached) {
      console.error('[Standalone] Using cached result');
      return cached as ScrapeResult;
    }

    try {
      // Rate limiting
      await facebookRateLimiter.acquire();

      const targetUrl = this.buildFacebookUrl(url);
      console.error(`[Standalone] Scraping: ${targetUrl}`);

      // Use retry wrapper for the entire scrape operation
      const html = await withRetry(
        () => this.scrapeWithContext(targetUrl, options),
        {
          maxRetries: 2,
          baseDelayMs: 3000,
          onRetry: (attempt, error) => {
            console.error(`[Standalone] Retry ${attempt}: ${error.message}`);
          }
        }
      );

      // Parse posts
      const posts = this.parser.parsePosts(html);

      // Apply limit
      const limitedPosts = posts.slice(0, options?.limit || 20);

      const result: ScrapeResult = {
        success: true,
        data: limitedPosts,
        adapter_used: this.name,
        metadata: {
          scrape_time_ms: Date.now() - startTime,
          url: targetUrl,
          timestamp: new Date().toISOString()
        }
      };

      // Cache successful result
      scrapeCache.set(cacheKey, result);

      return result;
    } catch (error) {
      console.error(`[Standalone] Error: ${error}`);
      return this.createErrorResult(error);
    }
  }

  async search(query: string, options?: SearchOptions): Promise<SearchResult> {
    const startTime = Date.now();
    const searchType = options?.type || 'posts';

    // Check cache
    const cacheKey = Cache.generateKey(`search:${query}`, options);
    const cached = searchCache.get(cacheKey);
    if (cached) {
      console.error('[Standalone] Using cached search result');
      return cached as SearchResult;
    }

    try {
      // Rate limiting
      await facebookRateLimiter.acquire();

      // Build search URL (use mbasic for better success rate)
      const searchUrl = `https://mbasic.facebook.com/search/${searchType}/?q=${encodeURIComponent(query)}`;
      console.error(`[Standalone] Searching: ${searchUrl}`);

      const html = await withRetry(
        () => this.searchWithContext(searchUrl, options),
        {
          maxRetries: 2,
          baseDelayMs: 3000
        }
      );

      const items = this.parser.parsePosts(html);

      const result: SearchResult = {
        success: true,
        data: {
          type: toSingularType(searchType),
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

      // Cache result
      searchCache.set(cacheKey, result);

      return result;
    } catch (error) {
      console.error(`[Standalone] Search error: ${error}`);
      return this.createSearchErrorResult(error);
    }
  }

  async cleanup(): Promise<void> {
    if (this.browser) {
      console.error('[Standalone] Closing browser...');
      await this.browser.close();
      this.browser = null;
    }
  }
}
