import { config } from '../config';

export function randomDelay(fixedDelay?: number): Promise<void> {
  const delay = fixedDelay ?? Math.floor(
    Math.random() * (config.delays.max - config.delays.min + 1) + config.delays.min
  );
  return new Promise(resolve => setTimeout(resolve, delay));
}

export function formatDate(date: Date): string {
  return date.toISOString();
}

export function toMarkdownListings(listings: any[]): string {
  if (listings.length === 0) {
    return '# Facebook Marketplace Search\n\nNo listings found.\n';
  }

  let markdown = '# Facebook Marketplace Search\n\n';
  
  listings.forEach((listing, index) => {
    markdown += `## ${index + 1}. ${listing.title}\n`;
    markdown += `- **ID:** ${listing.id}\n`;
    markdown += `- **Price:** $${listing.price} ${listing.currency}\n`;
    markdown += `- **Location:** ${listing.location}\n`;
    markdown += `- **Seller:** ${listing.seller?.name || 'Unknown'}\n`;
    markdown += `- **Posted:** ${listing.postedAt ? new Date(listing.postedAt).toLocaleDateString() : 'Unknown'}\n`;
    markdown += `- **URL:** ${listing.url}\n`;
    if (listing.description) {
      markdown += `- **Description:** ${listing.description.substring(0, 200)}${listing.description.length > 200 ? '...' : ''}\n`;
    }
    markdown += '\n';
  });

  return markdown;
}

export function toMarkdownMessages(messages: any[]): string {
  if (messages.length === 0) {
    return '# Conversation\n\nNo messages.\n';
  }

  let markdown = '# Conversation\n\n';
  
  messages.forEach(message => {
    const date = message.timestamp ? new Date(message.timestamp).toLocaleString() : 'Unknown';
    markdown += `**${message.senderName}** (${date}):\n`;
    markdown += `${message.text}\n\n`;
  });

  return markdown;
}

export function toMarkdownConversations(conversations: any[]): string {
  if (conversations.length === 0) {
    return '# Conversations\n\nNo conversations.\n';
  }

  let markdown = '# Conversations\n\n';
  
  conversations.forEach((conv, index) => {
    const participants = conv.participants?.map((p: any) => p.name).join(', ') || 'Unknown';
    markdown += `## ${index + 1}. ${participants}\n`;
    markdown += `- **ID:** ${conv.id}\n`;
    if (conv.lastMessage) {
      markdown += `- **Last Message:** ${conv.lastMessage.text.substring(0, 100)}${conv.lastMessage.text.length > 100 ? '...' : ''}\n`;
      markdown += `- **Time:** ${new Date(conv.lastMessage.timestamp).toLocaleString()}\n`;
    }
    markdown += `- **Unread:** ${conv.unreadCount || 0}\n\n`;
  });

  return markdown;
}
