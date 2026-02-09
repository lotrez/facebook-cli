# Facebook CLI

A headless CLI tool for exploring Facebook Marketplace and interacting with users via Messenger using browser automation (Playwright).

## Features

- **Marketplace Search**: Search for listings by keyword, location, price range, and category
- **Listing Details**: Get detailed information about specific listings
- **Messenger Integration**: List conversations, read messages, and send messages
- **Automatic Authentication**: Uses credentials from `.env` file, maintains sessions
- **Headless Operation**: Runs entirely in background, no browser window shown
- **LLM-Ready Output**: Supports JSON and Markdown output formats

## Installation

```bash
# Clone the repository
git clone <repository-url>
cd facebook-cli

# Install dependencies
bun install

# Install Playwright browsers
bunx playwright install chromium

# Copy environment file
cp .env.example .env

# Edit .env with your Facebook credentials
# FACEBOOK_EMAIL=your-email@example.com
# FACEBOOK_PASSWORD=your-password
```

## Usage

### Global Options

All commands support the following option:
- `--headed` - Show the browser window (defaults to headless)

### Marketplace Commands

**Search for listings:**
```bash
# Basic search
bun run src/index.ts search --query "vintage bike"

# With filters
bun run src/index.ts search \
  --query "laptop" \
  --location "San Francisco, CA" \
  --radius 20 \
  --min-price 100 \
  --max-price 500 \
  --limit 10 \
  --format json

# Output as markdown
bun run src/index.ts search --query "furniture" --format markdown

# Show browser window (headed mode)
bun run src/index.ts search --query "car" --headed
```

**Get listing details:**
```bash
bun run src/index.ts listing --id 1234567890 --format markdown
```

### Messenger Commands

**List conversations:**
```bash
bun run src/index.ts list --limit 20 --format json
```

**Read conversation messages:**
```bash
bun run src/index.ts read --conversation-id 1234567890 --limit 50
```

**Send a message:**
```bash
bun run src/index.ts send --user-id 1234567890 --message "Is this still available?"
```

## Configuration

Create a `.env` file in the project root:

```bash
FACEBOOK_EMAIL=your-email@example.com
FACEBOOK_PASSWORD=your-password
FACEBOOK_SESSION_DIR=~/.config/facebook-cli/sessions
FACEBOOK_HEADLESS=true
FACEBOOK_SLOW_MO=0
```

## Output Formats

### JSON (default)
Structured data suitable for programmatic use:
```json
{
  "listings": [
    {
      "id": "123456",
      "title": "Vintage Road Bike",
      "price": 200,
      "currency": "USD",
      "location": "San Francisco, CA",
      "seller": { "name": "John D.", "id": "789" },
      "url": "https://facebook.com/marketplace/item/123456",
      "images": ["https://..."],
      "postedAt": "2026-02-08T10:00:00.000Z"
    }
  ]
}
```

### Markdown
Human-readable format optimized for LLM consumption:
```markdown
# Facebook Marketplace Search

## 1. Vintage Road Bike - $200
- **Location:** San Francisco, CA
- **Seller:** John D.
- **Posted:** 2 days ago
- **URL:** https://facebook.com/marketplace/item/123456
```

## Testing

Run the test suite:
```bash
# Run all tests
bun test

# Run tests in watch mode
bun test --watch

# Run specific test file
bun test src/lib/browser.test.ts
```

**Note:** Tests that require Facebook credentials will be skipped if credentials are not configured in `.env`.

## Anti-Detection Measures

The CLI includes several measures to avoid detection:
- Random delays (1-5 seconds) between actions
- Human-like scrolling behavior
- Session persistence to reduce login frequency
- User agent rotation
- Viewport randomization

## Architecture

```
src/
  commands/
    marketplace.ts    # Marketplace commands
    messages.ts       # Messenger commands
  lib/
    browser.ts        # Playwright browser manager
    auth.ts           # Authentication & session handling
    marketplace.ts    # Marketplace scraping logic
    messenger.ts      # Messenger automation
    utils.ts          # Utility functions
  types/
    index.ts          # TypeScript type definitions
  config.ts           # Configuration management
  index.ts            # CLI entry point
```

## Development

```bash
# Type checking
bun run typecheck

# Development mode
bun run dev

# Build for production
bun run build
```

## Security Notes

- Credentials are stored in `.env` (do not commit this file)
- Session cookies are stored in `~/.config/facebook-cli/sessions/`
- No credential logging or exposure in output

## Disclaimer

This tool uses browser automation to interact with Facebook. This may violate Facebook's Terms of Service. Use at your own risk and consider using Facebook's official APIs where available.

## License

MIT
