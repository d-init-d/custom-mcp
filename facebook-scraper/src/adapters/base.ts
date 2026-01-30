/**
 * Base Adapter Interface
 */

import type { AdapterInterface, AdapterName, ScrapeOptions, ScrapeResult, SearchOptions, SearchResult } from '../types/adapters.js';

export abstract class BaseAdapter implements AdapterInterface {
  abstract name: AdapterName;

  abstract isAvailable(): Promise<boolean>;

  abstract scrapeUrl(url: string, options?: ScrapeOptions): Promise<ScrapeResult>;

  async scrapePage(pageUrl: string, options?: ScrapeOptions): Promise<ScrapeResult> {
    return this.scrapeUrl(pageUrl, options);
  }

  async scrapePost(postUrl: string, options?: ScrapeOptions): Promise<ScrapeResult> {
    return this.scrapeUrl(postUrl, options);
  }

  async scrapeComments(postUrl: string, options?: ScrapeOptions): Promise<ScrapeResult> {
    return this.scrapeUrl(postUrl, { ...options, include_comments: true });
  }

  abstract search(query: string, options?: SearchOptions): Promise<SearchResult>;

  protected createErrorResult(error: unknown): ScrapeResult {
    return {
      success: false,
      data: null,
      adapter_used: this.name,
      error: error instanceof Error ? error.message : String(error)
    };
  }

  protected createSearchErrorResult(error: unknown): SearchResult {
    return {
      success: false,
      data: null,
      adapter_used: this.name,
      error: error instanceof Error ? error.message : String(error)
    };
  }

  protected async randomDelay(minMs: number = 2000, maxMs: number = 5000): Promise<void> {
    const delay = Math.random() * (maxMs - minMs) + minMs;
    await new Promise(resolve => setTimeout(resolve, delay));
  }
}
