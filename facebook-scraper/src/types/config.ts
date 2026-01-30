/**
 * Configuration Types
 */

import type { AdapterName } from './adapters.js';

export interface Config {
  // MCP Detection
  brightdata_token?: string;
  firecrawl_api_key?: string;
  playwright_mcp_enabled: boolean;
  
  // Scraping settings
  default_strategy: AdapterName | 'auto';
  headless: boolean;
  timeout: number;
  max_retries: number;
  
  // Rate limiting
  delay_min_ms: number;
  delay_max_ms: number;
  
  // Facebook specific
  use_mbasic: boolean;
  user_agent: string;
  viewport: {
    width: number;
    height: number;
  };
}

export function loadConfig(): Config {
  return {
    // MCP tokens from environment
    brightdata_token: process.env.BRIGHTDATA_API_TOKEN,
    firecrawl_api_key: process.env.FIRECRAWL_API_KEY,
    playwright_mcp_enabled: process.env.PLAYWRIGHT_MCP_ENABLED === 'true',
    
    // Strategy
    default_strategy: (process.env.DEFAULT_STRATEGY as AdapterName) || 'auto',
    headless: process.env.HEADLESS !== 'false',
    timeout: parseInt(process.env.TIMEOUT || '30000'),
    max_retries: parseInt(process.env.MAX_RETRIES || '3'),
    
    // Rate limiting
    delay_min_ms: parseInt(process.env.DELAY_MIN_MS || '2000'),
    delay_max_ms: parseInt(process.env.DELAY_MAX_MS || '5000'),
    
    // Facebook
    use_mbasic: process.env.USE_MBASIC !== 'false',
    user_agent: process.env.USER_AGENT || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: {
      width: parseInt(process.env.VIEWPORT_WIDTH || '1920'),
      height: parseInt(process.env.VIEWPORT_HEIGHT || '1080')
    }
  };
}
