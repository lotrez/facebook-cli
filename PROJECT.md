# Facebook CLI - Project Specification

## Overview
A command-line interface for automating Facebook Marketplace browsing and Messenger interactions using browser automation.

## Goals
- Provide programmatic access to Facebook Marketplace
- Enable automated messaging via Facebook Messenger
- Output data in formats suitable for LLM consumption (JSON/Markdown)
- Operate completely headless with automatic authentication

## Non-Goals
- Official Facebook API integration
- GUI or interactive browser mode (headless only)
- Human-in-the-loop for authentication
- Support for multiple Facebook accounts simultaneously

## Features

### Phase 1: Core Infrastructure
- [ ] Bunli CLI framework setup
- [ ] Playwright browser automation
- [ ] Configuration management (.env support)
- [ ] Session persistence
- [ ] Logging system

### Phase 2: Authentication
- [ ] Automatic login with credentials
- [ ] Session cookie management
- [ ] Session validation and refresh
- [ ] Error handling for login failures

### Phase 3: Marketplace
- [ ] Search listings by keyword
- [ ] Filter by location, price, category
- [ ] Extract listing details (title, price, description, images, seller)
- [ ] Pagination support
- [ ] Get single listing details

### Phase 4: Messenger
- [ ] List conversations
- [ ] Read conversation messages
- [ ] Send messages
- [ ] Message polling/real-time updates (optional)

## Technical Requirements

### Dependencies
```json
{
  "dependencies": {
    "@bunli/core": "latest",
    "playwright": "latest",
    "puppeteer-extra-plugin-stealth": "latest",
    "zod": "latest",
    "dotenv": "latest"
  },
  "devDependencies": {
    "@types/bun": "latest",
    "typescript": "^5"
  }
}
```

### Browser Configuration
- **Engine**: Chromium (via Playwright)
- **Mode**: Headless
- **Viewport**: 1920x1080
- **User Agent**: Rotate between common desktop browsers
- **Stealth**: Enabled with puppeteer-extra-plugin-stealth

### Anti-Detection Strategy
1. Random delays (1000-5000ms) between actions
2. Human-like mouse movements
3. Natural scrolling patterns
4. Random viewport adjustments
5. Cookie persistence between sessions
6. Request rate limiting (max 1 req/3 seconds)

## Data Models

### Listing
```typescript
interface Listing {
  id: string;
  title: string;
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
```

### Conversation
```typescript
interface Conversation {
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
```

### Message
```typescript
interface Message {
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
```

## Command Specifications

### marketplace search
```bash
facebook-cli marketplace search "query" \
  --location "City, State" \
  --radius 20 \
  --min-price 0 \
  --max-price 1000 \
  --category vehicles \
  --limit 20 \
  --format json
```

### marketplace listing
```bash
facebook-cli marketplace listing <listing-id> --format markdown
```

### messages list
```bash
facebook-cli messages list --limit 20 --format json
```

### messages send
```bash
facebook-cli messages send <user-id> "Your message here"
```

### messages read
```bash
facebook-cli messages read <conversation-id> --limit 50 --format markdown
```

## Testing Strategy

### Unit Tests
- Utility functions
- Data transformation
- Configuration parsing

### Integration Tests
- Authentication flow
- Marketplace search
- Message operations
- Session management

### E2E Tests
- Full command execution
- Browser automation
- Output validation

### Test Requirements
- Use actual browser (not mocked)
- Test with real Facebook interactions
- Validate output formats
- Test error scenarios
- Include timeout handling

## Error Handling
- Graceful degradation on network issues
- Clear error messages for authentication failures
- Retry logic with exponential backoff
- Session expiration detection and auto-relogin

## Future Enhancements
- Support for posting listings
- Image upload functionality
- Price monitoring/alerts
- Batch messaging
- Export to CSV/Excel
- Webhook notifications
