/**
 * Firecrawl Adapter
 * Uses Firecrawl MCP for web scraping
 */

import { BaseAdapter } from './base.js';
import type { AdapterName, ScrapeOptions, ScrapeResult, SearchOptions, SearchResult } from '../types/adapters.js';
import { loadConfig } from '../types/config.js';
import { FacebookParser } from '../parsers/facebook-parser.js';

export class FirecrawlAdapter extends BaseAdapter {
  name: AdapterName = 'firecrawl';
  private parser = new FacebookParser();

  async isAvailable(): Promise<boolean> {
    const config = loadConfig();
    return !!config.firecrawl_api_key;
  }

  async scrapeUrl(url: string, options?: ScrapeOptions): Promise<ScrapeResult> {
    const startTime = Date.now();
    const config = loadConfig();

    try {
      if (!config.firecrawl_api_key) {
        throw new Error('Firecrawl API key not configured');
      }

      // Call Firecrawl API
      const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.firecrawl_api_key}`
        },
        body: JSON.stringify({
          url: url,
          formats: ['html', 'markdown']
        })
      });

      if (!response.ok) {
        throw new Error(`Firecrawl API error: ${response.status}`);
      }

      const data = await response.json() as { data?: { html?: string } };
      const html = data?.data?.html || '';
      const posts = this.parser.parsePosts(html);

      return {
        success: true,
        data: posts,
        adapter_used: this.name,
        metadata: {
          scrape_time_ms: Date.now() - startTime,
          url,
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      return this.createErrorResult(error);
    }
  }

  async search(query: string, options?: SearchOptions): Promise<SearchResult> {
    const startTime = Date.now();
    const searchType = options?.type || 'posts';

    try {
      // Use Firecrawl search
      const config = loadConfig();
      
      if (!config.firecrawl_api_key) {
        throw new Error('Firecrawl API key not configured');
      }

      const response = await fetch('https://api.firecrawl.dev/v1/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.firecrawl_api_key}`
        },
        body: JSON.stringify({
          query: `site:facebook.com ${query}`,
          limit: options?.limit || 10
        })
      });

      if (!response.ok) {
        throw new Error(`Firecrawl API error: ${response.status}`);
      }

      const data = await response.json() as { data?: Array<{ url: string; title: string }> };
      const results = data?.data || [];

      // Convert to Facebook format
      const items = results.map((r: { url: string; title: string }) => ({
        id: r.url,
        author: 'Unknown',
        content: r.title,
        post_url: r.url
      }));

      return {
        success: true,
        data: {
          type: searchType,
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
    } catch (error) {
      return this.createSearchErrorResult(error);
    }
  }
}
