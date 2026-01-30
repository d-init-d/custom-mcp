/**
 * Facebook Data Types
 */

export interface FacebookPost {
  id: string;
  author: string;
  author_url?: string;
  content: string;
  timestamp?: string;
  reactions?: {
    total: number;
    like?: number;
    love?: number;
    haha?: number;
    wow?: number;
    sad?: number;
    angry?: number;
  };
  comments_count?: number;
  shares_count?: number;
  images?: string[];
  videos?: string[];
  post_url: string;
}

export interface FacebookPage {
  id: string;
  name: string;
  url: string;
  username?: string;
  followers?: number;
  likes?: number;
  category?: string;
  description?: string;
  profile_image?: string;
  cover_image?: string;
  verified?: boolean;
}

export interface FacebookGroup {
  id: string;
  name: string;
  url: string;
  members_count?: number;
  privacy: 'public' | 'private' | 'closed';
  description?: string;
  admins?: string[];
}

export interface FacebookComment {
  id: string;
  author: string;
  author_url?: string;
  content: string;
  timestamp?: string;
  reactions_count?: number;
  replies_count?: number;
  replies?: FacebookComment[];
}

export interface FacebookMarketplaceItem {
  id: string;
  title: string;
  price: string;
  currency?: string;
  location: string;
  image_url?: string;
  item_url: string;
  seller?: string;
  condition?: string;
  posted_at?: string;
  description?: string;
}

export interface FacebookEvent {
  id: string;
  title: string;
  date: string;
  time?: string;
  location: string;
  event_url: string;
  image_url?: string;
  attendees_count?: number;
  interested_count?: number;
  description?: string;
  organizer?: string;
}

export interface FacebookSearchResult {
  type: 'post' | 'page' | 'group' | 'event' | 'marketplace';
  items: (FacebookPost | FacebookPage | FacebookGroup | FacebookEvent | FacebookMarketplaceItem)[];
  total_count?: number;
  has_more?: boolean;
}
