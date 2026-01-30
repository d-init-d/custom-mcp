/**
 * Bright Data Adapter
 * Uses Bright Data MCP for anti-block scraping
 */

import { BaseAdapter } from './base.js';
import type { AdapterName, ScrapeOptions, ScrapeResult, SearchOptions, SearchResult } from '../types/adapters.js';
import { toSingularType } from '../types/adapters.js';
import { loadConfig } from '../types/config.js';
import { FacebookParser } from '../parsers/facebook-parser.js';

export class BrightDataAdapter extends BaseAdapter {
  name: AdapterName = 'brightdata';
  private parser = new FacebookParser();

  async isAvailable(): Promise<boolean> {
    const config = loadConfig();
    return !!config.brightdata_token;
  }

  async scrapeUrl(url: string, options?: ScrapeOptions): Promise<ScrapeResult> {
    const startTime = Date.now();
    const config = loadConfig();

    try {
      if (!config.brightdata_token) {
        throw new Error('Bright Data API token not configured');
      }

      // Call Bright Data API directly
      const response = await fetch('https://api.brightdata.com/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.brightdata_token}`
        },
        body: JSON.stringify({
          zone: 'mcp_unlocker',
          url: url,
          format: 'raw'
        })
      });

      if (!response.ok) {
        throw new Error(`Bright Data API error: ${response.status}`);
      }

      const html = await response.text();
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
    const config = loadConfig();
    const searchType = options?.type || 'posts';

    try {
      if (!config.brightdata_token) {
        throw new Error('Bright Data API token not configured');
      }

      // Build Facebook search URL
      const searchUrl = `https://www.facebook.com/search/${searchType}?q=${encodeURIComponent(query)}`;

      const response = await fetch('https://api.brightdata.com/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.brightdata_token}`
        },
        body: JSON.stringify({
          zone: 'mcp_unlocker',
          url: searchUrl,
          format: 'raw'
        })
      });

      if (!response.ok) {
        throw new Error(`Bright Data API error: ${response.status}`);
      }

      const html = await response.text();
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
      return this.createSearchErrorResult(error);
    }
  }
}
