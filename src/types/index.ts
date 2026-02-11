export interface Listing {
  id: string;
  title: string | null;
  price: number;
  currency: string;
  location: string;
  description?: string;
  images: string[];
  seller: {
    id: string;
    name: string;
    rating?: number;
  };
  url: string;
  postedAt: Date;
  category?: string;
  condition?: string;
}

export interface Conversation {
  id: string;
  participants: {
    id: string;
    name: string;
  }[];
  lastMessage?: {
    text: string;
    timestamp: Date;
    senderId: string;
  };
  unreadCount: number;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: Date;
  attachments?: {
    type: 'image' | 'file';
    url: string;
  }[];
}

export interface SearchOptions {
  query: string;
  location?: string;
  radius?: number;
  minPrice?: number;
  maxPrice?: number;
  category?: string;
  limit?: number;
}

export interface MessageOptions {
  limit?: number;
}

export type OutputFormat = 'json' | 'markdown';
