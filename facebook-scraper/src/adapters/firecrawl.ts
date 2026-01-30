/**
 * Firecrawl Adapter
 * Uses Firecrawl MCP for web scraping
 */

import { BaseAdapter } from './base.js';
import type { AdapterName, ScrapeOptions, ScrapeResult, SearchOptions, SearchResult } from '../types/adapters.js';
import { toSingularType } from '../types/adapters.js';
import { loadConfig } from '../types/config.js';
import { FacebookParser } from '../parsers/facebook-parser.js';
import { fetchWithRetry } from '../utils/retry.js';
import { facebookRateLimiter } from '../utils/rate-limiter.js';
import { scrapeCache, searchCache, Cache } from '../utils/cache.js';

export class FirecrawlAdapter extends BaseAdapter {
  name: AdapterName = 'firecrawl';
  private parser = new FacebookParser();
  private baseUrl = 'https://api.firecrawl.dev/v1';

  async isAvailable(): Promise<boolean> {
    const config = loadConfig();
    return !!config.firecrawl_api_key;
  }

  private getHeaders(config: ReturnType<typeof loadConfig>): HeadersInit {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.firecrawl_api_key}`
    };
  }

  async scrapeUrl(url: string, options?: ScrapeOptions): Promise<ScrapeResult> {
    const startTime = Date.now();
    const config = loadConfig();

    // Check cache first
    const cacheKey = Cache.generateKey(url, options);
    const cached = scrapeCache.get(cacheKey);
    if (cached) {
      console.error('[Firecrawl] Using cached result');
      return cached as ScrapeResult;
    }

    try {
      if (!config.firecrawl_api_key) {
        throw new Error('Firecrawl API key not configured');
      }

      // Rate limiting
      await facebookRateLimiter.acquire();

      console.error(`[Firecrawl] Scraping: ${url}`);

      const response = await fetchWithRetry(`${this.baseUrl}/scrape`, {
        method: 'POST',
        headers: this.getHeaders(config),
        body: JSON.stringify({
          url: url,
          formats: ['html', 'markdown'],
          waitFor: 3000,  // Wait for dynamic content
          timeout: options?.timeout || 30000,
          onlyMainContent: false  // Get full page for Facebook
        })
      }, {
        maxRetries: 2,
        baseDelayMs: 2000
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Firecrawl API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json() as { 
        success: boolean;
        data?: { 
          html?: string; 
          markdown?: string;
          metadata?: Record<string, any>;
        };
        error?: string;
      };

      if (!data.success || !data.data) {
        throw new Error(data.error || 'Firecrawl returned no data');
      }

      const html = data.data.html || '';
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
      console.error(`[Firecrawl] Error: ${error}`);
      return this.createErrorResult(error);
    }
  }

  async search(query: string, options?: SearchOptions): Promise<SearchResult> {
    const startTime = Date.now();
    const searchType = options?.type || 'posts';
    const config = loadConfig();

    // Check cache
    const cacheKey = Cache.generateKey(`search:${query}`, options);
    const cached = searchCache.get(cacheKey);
    if (cached) {
      console.error('[Firecrawl] Using cached search result');
      return cached as SearchResult;
    }

    try {
      if (!config.firecrawl_api_key) {
        throw new Error('Firecrawl API key not configured');
      }

      // Rate limiting
      await facebookRateLimiter.acquire();

      console.error(`[Firecrawl] Searching: ${query}`);

      const response = await fetchWithRetry(`${this.baseUrl}/search`, {
        method: 'POST',
        headers: this.getHeaders(config),
        body: JSON.stringify({
          query: `site:facebook.com ${query}`,
          limit: options?.limit || 10,
          scrapeOptions: {
            formats: ['markdown'],
            onlyMainContent: true
          }
        })
      }, {
        maxRetries: 2,
        baseDelayMs: 2000
      });

      if (!response.ok) {
        throw new Error(`Firecrawl search API error: ${response.status}`);
      }

      const data = await response.json() as { 
        success: boolean;
        data?: Array<{ 
          url: string; 
          title?: string; 
          description?: string;
          markdown?: string;
        }>;
      };

      const results = data?.data || [];

      // Convert to Facebook format
      const items = results.map((r, index) => ({
        id: `fc_${index}_${Date.now()}`,
        author: 'Unknown',
        content: r.description || r.title || '',
        post_url: r.url
      }));

      const result: SearchResult = {
        success: true,
        data: {
          type: toSingularType(searchType),
          items: items,
          total_count: items.length,
          has_more: false
        },
        adapter_used: this.name,
        metadata: {
          search_time_ms: Date.now() - startTime,
          query,
          timestamp: new Date().toISOString()
        }
      };

      // Cache results
      searchCache.set(cacheKey, result);

      return result;
    } catch (error) {
      console.error(`[Firecrawl] Search error: ${error}`);
      return this.createSearchErrorResult(error);
    }
  }
}
