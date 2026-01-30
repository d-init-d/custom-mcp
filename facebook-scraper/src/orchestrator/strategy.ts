/**
 * Strategy Orchestrator
 * Manages adapter selection and fallback logic
 */

import type { AdapterName, ScrapeOptions, ScrapeResult, SearchOptions, SearchResult } from '../types/adapters.js';
import type { BaseAdapter } from '../adapters/base.js';
import { BrightDataAdapter } from '../adapters/brightdata.js';
import { FirecrawlAdapter } from '../adapters/firecrawl.js';
import { PlaywrightMCPAdapter } from '../adapters/playwright-mcp.js';
import { StandaloneAdapter } from '../adapters/standalone.js';
import { mcpDetector } from '../detector/mcp-detector.js';

export class StrategyOrchestrator {
  private adapters: Map<AdapterName, BaseAdapter> = new Map();
  private priorityOrder: AdapterName[] = [];
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Detect available MCPs
    const detected = await mcpDetector.detect();

    // Create adapters for detected MCPs
    for (const mcp of detected) {
      const adapter = this.createAdapter(mcp.name);
      if (adapter) {
        this.adapters.set(mcp.name, adapter);
        this.priorityOrder.push(mcp.name);
      }
    }

    console.error(`[Orchestrator] Initialized with adapters: ${this.priorityOrder.join(', ')}`);
    this.initialized = true;
  }

  private createAdapter(name: AdapterName): BaseAdapter | null {
    switch (name) {
      case 'brightdata':
        return new BrightDataAdapter();
      case 'firecrawl':
        return new FirecrawlAdapter();
      case 'playwright-mcp':
        return new PlaywrightMCPAdapter();
      case 'standalone':
        return new StandaloneAdapter();
      default:
        return null;
    }
  }

  async scrape(url: string, options?: ScrapeOptions): Promise<ScrapeResult> {
    await this.initialize();

    // If specific strategy requested
    if (options?.strategy && options.strategy !== 'auto') {
      const adapter = this.adapters.get(options.strategy);
      if (adapter) {
        console.error(`[Orchestrator] Using requested strategy: ${options.strategy}`);
        return adapter.scrapeUrl(url, options);
      }
    }

    // Auto mode: try each adapter in priority order
    for (const adapterName of this.priorityOrder) {
      const adapter = this.adapters.get(adapterName);
      if (!adapter) continue;

      try {
        console.error(`[Orchestrator] Trying ${adapterName}...`);
        const result = await adapter.scrapeUrl(url, options);

        if (result.success) {
          console.error(`[Orchestrator] ✅ ${adapterName} succeeded`);
          return result;
        } else {
          console.error(`[Orchestrator] ⚠️ ${adapterName} returned error: ${result.error}`);
        }
      } catch (error) {
        console.error(`[Orchestrator] ❌ ${adapterName} threw error: ${error}`);
      }
    }

    return {
      success: false,
      data: null,
      adapter_used: 'standalone',
      error: 'All adapters failed'
    };
  }

  async scrapePage(pageUrl: string, options?: ScrapeOptions): Promise<ScrapeResult> {
    return this.scrape(pageUrl, options);
  }

  async scrapePost(postUrl: string, options?: ScrapeOptions): Promise<ScrapeResult> {
    return this.scrape(postUrl, options);
  }

  async scrapeComments(postUrl: string, options?: ScrapeOptions): Promise<ScrapeResult> {
    return this.scrape(postUrl, { ...options, include_comments: true });
  }

  async search(query: string, options?: SearchOptions): Promise<SearchResult> {
    await this.initialize();

    // If specific strategy requested
    if (options?.strategy && options.strategy !== 'auto') {
      const adapter = this.adapters.get(options.strategy);
      if (adapter) {
        console.error(`[Orchestrator] Using requested strategy: ${options.strategy}`);
        return adapter.search(query, options);
      }
    }

    // Auto mode: try each adapter in priority order
    for (const adapterName of this.priorityOrder) {
      const adapter = this.adapters.get(adapterName);
      if (!adapter) continue;

      try {
        console.error(`[Orchestrator] Trying ${adapterName} for search...`);
        const result = await adapter.search(query, options);

        if (result.success) {
          console.error(`[Orchestrator] ✅ ${adapterName} search succeeded`);
          return result;
        } else {
          console.error(`[Orchestrator] ⚠️ ${adapterName} search returned error: ${result.error}`);
        }
      } catch (error) {
        console.error(`[Orchestrator] ❌ ${adapterName} search threw error: ${error}`);
      }
    }

    return {
      success: false,
      data: null,
      adapter_used: 'standalone',
      error: 'All adapters failed for search'
    };
  }

  getAvailableAdapters(): AdapterName[] {
    return [...this.priorityOrder];
  }

  async cleanup(): Promise<void> {
    for (const adapter of this.adapters.values()) {
      if ('cleanup' in adapter && typeof adapter.cleanup === 'function') {
        await adapter.cleanup();
      }
    }
  }
}

export const orchestrator = new StrategyOrchestrator();
