/**
 * Facebook HTML Parser
 * Parses Facebook HTML content into structured data
 * Updated with modern selectors for both mbasic and regular Facebook
 */

import * as cheerio from 'cheerio';
import type { FacebookPost, FacebookPage, FacebookComment } from '../types/facebook.js';

// Selector configurations for different Facebook versions
const SELECTORS = {
  // mbasic.facebook.com selectors
  mbasic: {
    posts: [
      'div[data-ft]',
      'article',
      'div.story_body_container',
      'div#m_story_permalink_view',
      'div[data-sigil="story-div"]',
      'section > div > div > div'  // Generic structure
    ],
    author: [
      'a strong',
      'h3 a',
      'header a',
      'a[href*="/profile"]',
      'a[href*="/pages"]',
      'a[href*="user"]'
    ],
    content: [
      'div[data-ft] > div > span',
      'div.story_body_container > div',
      'p',
      'span[lang]',
      'div[dir="auto"]'
    ],
    timestamp: [
      'abbr',
      'time',
      'span[data-utime]',
      'a[href*="story_time"]'
    ],
    link: [
      'a[href*="/story"]',
      'a[href*="/posts/"]',
      'a[href*="/permalink"]',
      'a[href*="story_fbid"]'
    ]
  },
  
  // Regular facebook.com selectors (more complex due to React)
  regular: {
    posts: [
      '[data-pagelet*="FeedUnit"]',
      '[data-testid="Keycommand_wrapper"]',
      'div[role="article"]',
      'div[data-ad-preview]',
      'div.userContentWrapper'
    ],
    author: [
      'h2 a',
      'h3 a',
      'strong a',
      'a[role="link"][href*="/user"]',
      'a[role="link"][href*="/profile"]',
      'span.fwb a'  // Old Facebook
    ],
    content: [
      'div[data-testid="post_message"]',
      'div[data-ad-comet-preview]',
      'div[dir="auto"]',
      'span[dir="auto"]',
      'div[class*="userContent"]'
    ],
    timestamp: [
      'a[role="link"] span[aria-labelledby]',
      'abbr[data-utime]',
      'span[id*="jsc_c"] a',
      'a[href*="posts/"]'
    ],
    link: [
      'a[href*="/posts/"]',
      'a[href*="story_fbid"]',
      'a[href*="/permalink/"]'
    ]
  }
};

export class FacebookParser {
  
  /**
   * Detect if HTML is from mbasic or regular Facebook
   */
  private detectFacebookVersion(html: string): 'mbasic' | 'regular' {
    if (html.includes('mbasic.facebook.com') || html.includes('m.facebook.com')) {
      return 'mbasic';
    }
    if (html.includes('data-pagelet') || html.includes('__comet_')) {
      return 'regular';
    }
    return 'mbasic'; // Default to mbasic as it's simpler
  }

  /**
   * Parse posts from Facebook HTML
   */
  parsePosts(html: string): FacebookPost[] {
    const $ = cheerio.load(html);
    const posts: FacebookPost[] = [];
    const version = this.detectFacebookVersion(html);
    const selectors = SELECTORS[version];
    
    console.error(`[Parser] Detected Facebook version: ${version}`);

    // Try each post selector
    for (const postSelector of selectors.posts) {
      const elements = $(postSelector);
      
      if (elements.length > 0) {
        console.error(`[Parser] Found ${elements.length} elements with selector: ${postSelector}`);
        
        elements.each((index, element) => {
          try {
            const post = this.parsePostElement($, $(element), selectors);
            if (post && post.content && post.content.length > 10) {
              // Avoid duplicates
              const exists = posts.some(p => 
                p.content === post.content || 
                (p.id === post.id && post.id !== 'unknown')
              );
              if (!exists) {
                posts.push(post);
              }
            }
          } catch (error) {
            // Skip malformed posts
            console.error(`[Parser] Error parsing post: ${error}`);
          }
        });

        if (posts.length > 0) break;
      }
    }

    // Fallback: try to find any text content that looks like posts
    if (posts.length === 0) {
      console.error('[Parser] Using fallback text extraction');
      this.extractFallbackPosts($, posts);
    }

    console.error(`[Parser] Extracted ${posts.length} posts`);
    return posts.slice(0, 50); // Limit to 50 posts
  }

  private parsePostElement(
    $: cheerio.CheerioAPI, 
    element: any,
    selectors: typeof SELECTORS.mbasic
  ): FacebookPost | null {
    // Try to extract post ID
    const dataFt = element.attr('data-ft');
    let postId = `post_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    if (dataFt) {
      try {
        const ftData = JSON.parse(dataFt);
        if (ftData.mf_story_key) {
          postId = String(ftData.mf_story_key);
        } else if (ftData.top_level_post_id) {
          postId = String(ftData.top_level_post_id);
        }
      } catch {
        // Ignore JSON parse errors
      }
    }

    // Extract author using multiple selectors
    let author = 'Unknown';
    let authorUrl: string | undefined;
    
    for (const authorSelector of selectors.author) {
      const authorElement = element.find(authorSelector).first();
      const text = authorElement.text().trim();
      if (text && text.length > 0 && text.length < 100) {
        author = text;
        authorUrl = authorElement.attr('href') || undefined;
        if (authorUrl && !authorUrl.startsWith('http')) {
          authorUrl = `https://www.facebook.com${authorUrl}`;
        }
        break;
      }
    }

    // Extract content using multiple selectors
    let content = '';
    for (const contentSelector of selectors.content) {
      const found = element.find(contentSelector).first().text().trim();
      if (found && found.length > content.length) {
        content = found;
      }
    }

    // Fallback: get element text
    if (!content || content.length < 10) {
      content = element.text().trim();
      // Clean up the content
      content = content
        .replace(/\s+/g, ' ')
        .replace(/^(.*?)\s*\d+\s*(Like|Comment|Share)/i, '$1')
        .substring(0, 1000);
    }

    // Extract timestamp
    let timestamp: string | undefined;
    for (const timeSelector of selectors.timestamp) {
      const timeElement = element.find(timeSelector).first();
      timestamp = timeElement.attr('title') || 
                  timeElement.attr('data-utime') || 
                  timeElement.text().trim() || 
                  undefined;
      if (timestamp) break;
    }

    // Extract post URL
    let postUrl = '';
    for (const linkSelector of selectors.link) {
      const linkElement = element.find(linkSelector).first();
      const href = linkElement.attr('href');
      if (href) {
        postUrl = href.startsWith('http') ? href : `https://www.facebook.com${href}`;
        // Clean URL params
        try {
          const url = new URL(postUrl);
          url.searchParams.delete('__cft__');
          url.searchParams.delete('__tn__');
          postUrl = url.toString();
        } catch {
          // Keep original
        }
        break;
      }
    }

    // Extract reactions
    const reactionsText = element.find('span[id*="like"], a[href*="reaction"]').text();
    const reactionsMatch = reactionsText.match(/(\d+)/);
    const reactionsTotal = reactionsMatch ? parseInt(reactionsMatch[1]) : 0;

    // Extract comments count
    const commentsText = element.find('a[href*="comment"]').text();
    const commentsMatch = commentsText.match(/(\d+)/);
    const commentsCount = commentsMatch ? parseInt(commentsMatch[1]) : 0;

    // Extract shares count
    const sharesText = element.find('a[href*="share"]').text();
    const sharesMatch = sharesText.match(/(\d+)/);
    const sharesCount = sharesMatch ? parseInt(sharesMatch[1]) : 0;

    // Extract images
    const images: string[] = [];
    element.find('img[src*="fbcdn"], img[data-src*="fbcdn"]').each((_: any, img: any) => {
      const src = $(img).attr('src') || $(img).attr('data-src');
      if (src && !src.includes('emoji') && !src.includes('static')) {
        images.push(src);
      }
    });

    return {
      id: postId,
      author,
      author_url: authorUrl,
      content: content.substring(0, 2000),
      timestamp,
      reactions: reactionsTotal > 0 ? { total: reactionsTotal } : undefined,
      comments_count: commentsCount || undefined,
      shares_count: sharesCount || undefined,
      images: images.length > 0 ? images : undefined,
      post_url: postUrl
    };
  }

  private extractFallbackPosts($: cheerio.CheerioAPI, posts: FacebookPost[]): void {
    // Look for paragraphs or divs with substantial text
    $('p, div[dir="auto"], span[lang]').each((index, element) => {
      const text = $(element).text().trim();
      if (text.length > 50 && text.length < 5000) {
        // Check it's not navigation or UI text
        const lowerText = text.toLowerCase();
        if (!lowerText.includes('log in') && 
            !lowerText.includes('sign up') && 
            !lowerText.includes('create account')) {
          posts.push({
            id: `fallback_${index}`,
            author: 'Unknown',
            content: text.substring(0, 500),
            post_url: ''
          });
        }
      }
    });
  }

  /**
   * Parse page info from Facebook HTML
   */
  parsePage(html: string): FacebookPage | null {
    const $ = cheerio.load(html);

    try {
      const title = $('title').text().trim();
      const name = title.replace(' | Facebook', '').replace(' - Facebook', '');
      const description = $('meta[name="description"]').attr('content') || '';
      const url = $('meta[property="og:url"]').attr('content') || '';
      const profileImage = $('img[alt*="profile"], img.profilePicThumb, img[data-imgperflogname="profilePhoto"]').first().attr('src') || undefined;

      // Extract followers/likes count
      const statsText = $('body').text();
      const followersMatch = statsText.match(/([\d,.]+[KMB]?)\s*followers?/i);
      const likesMatch = statsText.match(/([\d,.]+[KMB]?)\s*likes?/i);

      const parseCount = (str: string): number => {
        const cleaned = str.replace(/,/g, '');
        const multipliers: Record<string, number> = { 'K': 1000, 'M': 1000000, 'B': 1000000000 };
        const match = cleaned.match(/([\d.]+)([KMB])?/i);
        if (match) {
          const num = parseFloat(match[1]);
          const mult = match[2] ? multipliers[match[2].toUpperCase()] : 1;
          return Math.round(num * mult);
        }
        return parseInt(cleaned) || 0;
      };

      const followers = followersMatch ? parseCount(followersMatch[1]) : undefined;
      const likes = likesMatch ? parseCount(likesMatch[1]) : undefined;

      // Extract category
      const category = $('span[class*="category"], a[href*="/category/"]').first().text().trim() || undefined;

      return {
        id: url.split('/').filter(Boolean).pop() || '',
        name,
        url,
        description,
        followers,
        likes,
        category,
        profile_image: profileImage
      };
    } catch (error) {
      console.error(`[Parser] Error parsing page: ${error}`);
      return null;
    }
  }

  /**
   * Parse comments from Facebook HTML
   */
  parseComments(html: string): FacebookComment[] {
    const $ = cheerio.load(html);
    const comments: FacebookComment[] = [];
    const version = this.detectFacebookVersion(html);

    const commentSelectors = version === 'mbasic' 
      ? ['div[id*="comment"]', 'div.reply', 'li.comment']
      : ['div[data-testid="comment"]', 'div.UFIComment', 'ul.commentList > li'];

    for (const selector of commentSelectors) {
      $(selector).each((index, element) => {
        const author = $(element).find('a').first().text().trim() || 'Unknown';
        const content = $(element).find('span, p').text().trim();
        
        if (content && content.length > 0) {
          comments.push({
            id: `comment_${index}`,
            author,
            content: content.substring(0, 1000),
            timestamp: undefined,
            reactions_count: 0,
            replies_count: 0
          });
        }
      });

      if (comments.length > 0) break;
    }

    return comments;
  }
}
