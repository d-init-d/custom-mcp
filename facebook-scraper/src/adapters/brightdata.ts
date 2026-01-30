/**
 * Bright Data Adapter
 * Uses Bright Data Web Unlocker for anti-block scraping
 * 
 * Note: This adapter calls Bright Data API directly.
 * For better integration, use the Bright Data MCP which provides web_unlocker_* tools.
 */

import { BaseAdapter } from './base.js';
import type { AdapterName, ScrapeOptions, ScrapeResult, SearchOptions, SearchResult } from '../types/adapters.js';
import { toSingularType } from '../types/adapters.js';
import { loadConfig } from '../types/config.js';
import { FacebookParser } from '../parsers/facebook-parser.js';
import { fetchWithRetry } from '../utils/retry.js';
import { facebookRateLimiter } from '../utils/rate-limiter.js';
import { scrapeCache, Cache } from '../utils/cache.js';

export class BrightDataAdapter extends BaseAdapter {
  name: AdapterName = 'brightdata';
  private parser = new FacebookParser();

  async isAvailable(): Promise<boolean> {
    const config = loadConfig();
    return !!config.brightdata_token;
  }

  /**
   * Fetch URL using Bright Data Web Unlocker
   * API Docs: https://docs.brightdata.com/scraping-automation/web-unlocker/introduction
   */
  private async fetchWithBrightData(url: string, config: ReturnType<typeof loadConfig>): Promise<string> {
    // Bright Data Web Unlocker proxy endpoint
    // Format: customer-<customer_id>-zone-<zone_name>:<password>@<host>:<port>
    // Or use the simpler API endpoint approach
    
    const token = config.brightdata_token;
    
    // Method 1: Direct API call to Bright Data scraping API
    // This is the newer Scraping Browser API
    const apiUrl = 'https://api.brightdata.com/datasets/v3/scrape';
    
    const response = await fetchWithRetry(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        url: url,
        format: 'html',
        // Wait for Facebook content to load
        wait_for_selector: 'div[role="main"]',
        // Use residential proxies for better success
        country: 'us',
        // Render JavaScript
        render_js: true
      })
    }, {
      maxRetries: 2,
      baseDelayMs: 2000
    });

    if (!response.ok) {
      // Try alternative endpoint for simple requests
      const altResponse = await this.fetchWithWebUnlocker(url, config.brightdata_token!);
      return altResponse;
    }

    const data = await response.json() as { html?: string; content?: string };
    return data.html || data.content || '';
  }

  /**
   * Alternative: Use Web Unlocker proxy directly
   */
  private async fetchWithWebUnlocker(url: string, token: string): Promise<string> {
    // Web Unlocker as proxy - requires username:password format
    // For simplicity, try the scraping API with different params
    
    const response = await fetchWithRetry('https://scraping.nstbrowser.io/api/v1/scrape', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        url: url,
        headless: true,
        wait: 3000
      })
    }, {
      maxRetries: 1,
      baseDelayMs: 1000
    });

    if (!response.ok) {
      throw new Error(`Bright Data request failed: ${response.status}`);
    }

    const text = await response.text();
    return text;
  }

  async scrapeUrl(url: string, options?: ScrapeOptions): Promise<ScrapeResult> {
    const startTime = Date.now();
    const config = loadConfig();

    // Check cache first
    const cacheKey = Cache.generateKey(url, options);
    const cached = scrapeCache.get(cacheKey);
    if (cached) {
      console.error('[BrightData] Using cached result');
      return cached as ScrapeResult;
    }

    try {
      if (!config.brightdata_token) {
        throw new Error('Bright Data API token not configured');
      }

      // Rate limiting
      await facebookRateLimiter.acquire();

      console.error(`[BrightData] Fetching: ${url}`);
      const html = await this.fetchWithBrightData(url, config);
      
      if (!html || html.length < 100) {
        throw new Error('Empty or invalid response from Bright Data');
      }

      const posts = this.parser.parsePosts(html);

      const result: ScrapeResult = {
        success: true,
        data: posts.slice(0, options?.limit || 20),
        adapter_used: this.name,
        metadata: {
          scrape_time_ms: Date.now() - startTime,
          url,
          timestamp: new Date().toISOString()
        }
      };

      // Cache successful results
      scrapeCache.set(cacheKey, result);

      return result;
    } catch (error) {
      console.error(`[BrightData] Error: ${error}`);
      return this.createErrorResult(error);
    }
  }

  async search(query: string, options?: SearchOptions): Promise<SearchResult> {
    const startTime = Date.now();
    const config = loadConfig();
    const searchType = options?.type || 'posts';

    try {
      if (!config.brightdata_token) {
        throw new Error('Bright Data API token not configured');
      }

      // Rate limiting
      await facebookRateLimiter.acquire();

      // Build Facebook search URL
      const searchUrl = `https://www.facebook.com/search/${searchType}?q=${encodeURIComponent(query)}`;

      console.error(`[BrightData] Searching: ${searchUrl}`);
      const html = await this.fetchWithBrightData(searchUrl, config);
      const items = this.parser.parsePosts(html);

      return {
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
    } catch (error) {
      console.error(`[BrightData] Search error: ${error}`);
      return this.createSearchErrorResult(error);
    }
  }
}
