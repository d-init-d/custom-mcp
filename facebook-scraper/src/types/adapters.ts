/**
 * Adapter Types
 */

import type { FacebookPost, FacebookPage, FacebookComment, FacebookSearchResult } from './facebook.js';

export type AdapterName = 'brightdata' | 'firecrawl' | 'playwright-mcp' | 'standalone';

export interface DetectedMCP {
  name: AdapterName;
  available: boolean;
  priority: number;
  reason?: string;
}

export interface ScrapeOptions {
  limit?: number;
  include_comments?: boolean;
  timeout?: number;
  strategy?: AdapterName | 'auto';
}

export interface SearchOptions {
  type: 'posts' | 'pages' | 'groups' | 'events' | 'marketplace';
  limit?: number;
  strategy?: AdapterName | 'auto';
}

export interface ScrapeResult {
  success: boolean;
  data: FacebookPost[] | FacebookPage | FacebookComment[] | null;
  adapter_used: AdapterName;
  error?: string;
  metadata?: {
    scrape_time_ms: number;
    url: string;
    timestamp: string;
  };
}

export interface SearchResult {
  success: boolean;
  data: FacebookSearchResult | null;
  adapter_used: AdapterName;
  error?: string;
  metadata?: {
    search_time_ms: number;
    query: string;
    timestamp: string;
  };
}

export interface AdapterInterface {
  name: AdapterName;
  isAvailable(): Promise<boolean>;
  scrapeUrl(url: string, options?: ScrapeOptions): Promise<ScrapeResult>;
  scrapePage(pageUrl: string, options?: ScrapeOptions): Promise<ScrapeResult>;
  scrapePost(postUrl: string, options?: ScrapeOptions): Promise<ScrapeResult>;
  scrapeComments(postUrl: string, options?: ScrapeOptions): Promise<ScrapeResult>;
  search(query: string, options?: SearchOptions): Promise<SearchResult>;
}
