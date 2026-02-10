# Facebook CLI - SKILL Guide for LLMs

## Overview
A headless CLI tool for automating Facebook Marketplace browsing and Messenger interactions. Perfect for programmatically searching listings, extracting data, and managing conversations.

## Installation & Usage

### Quick Start with npx
```bash
# Run directly without installation
npx @lucienpoirier/facebook-cli <command>

# Or install globally
npm install -g @lucienpoirier/facebook-cli
facebook-cli <command>
```

## Environment Setup

Create a `.env` file in your working directory:
```bash
FACEBOOK_EMAIL=your-email@example.com
FACEBOOK_PASSWORD=your-password
FACEBOOK_PIN=123456                    # PIN for accessing messages
FACEBOOK_SESSION_DIR=~/.config/facebook-cli/sessions
FACEBOOK_HEADLESS=true                 # Run in background
FACEBOOK_SLOW_MO=0                     # Slow motion delay (ms)
```

**Important:** Never commit credentials to version control!

## Commands

### Marketplace Search
Search Facebook Marketplace listings with filters.

```bash
facebook-cli search --query "laptop" --limit 10 --format json
```

**Options:**
- `--query, -q` (required): Search query string
- `--location, -l`: Location filter (e.g., "San Francisco, CA")
- `--radius, -r`: Search radius in miles
- `--min-price`: Minimum price
- `--max-price`: Maximum price
- `--category`: Category filter
- `--limit`: Maximum results (default: 20)
- `--format`: Output format - `json` or `markdown` (default: json)
- `--headed`: Show browser window for debugging

**Example:**
```bash
facebook-cli search \
  --query "vintage bike" \
  --location "Los Angeles, CA" \
  --radius 25 \
  --min-price 50 \
  --max-price 500 \
  --limit 10 \
  --format markdown
```

### Get Listing Details
Retrieve detailed information about a specific listing.

```bash
facebook-cli listing --id <listing-id> --format json
```

**Options:**
- `--id` (required): Listing ID from search results
- `--format`: Output format - `json` or `markdown`
- `--headed`: Show browser window

**Example:**
```bash
facebook-cli listing --id 883624684520276 --format markdown
```

### List Conversations
List all Marketplace conversations.

```bash
facebook-cli list --limit 20 --format json
```

**Options:**
- `--limit`: Maximum conversations (default: 20)
- `--format`: Output format - `json` or `markdown`
- `--headed`: Show browser window

**Example Output:**
```json
{
  "conversations": [
    {
      "id": "883624684520276",
      "participants": [{"name": "Antoine"}],
      "lastMessage": {
        "text": "2003 Mazda mx5...",
        "timestamp": "2026-02-10T22:56:22.777Z"
      }
    }
  ]
}
```

### Read Messages
Read messages from a specific conversation.

```bash
facebook-cli read --conversation-id <id> --limit 50 --format json
```

**Options:**
- `--conversation-id` (required): Conversation ID from list command
- `--limit`: Maximum messages (default: 50)
- `--format`: Output format - `json` or `markdown`
- `--headed`: Show browser window

**Example:**
```bash
facebook-cli read --conversation-id 883624684520276 --limit 10
```

### Send Message
Send a message to a user.

```bash
facebook-cli send --user-id <user-id> --message "Your message here"
```

**Options:**
- `--user-id` (required): User ID or conversation ID
- `--message` (required): Message text
- `--headed`: Show browser window

**Example:**
```bash
facebook-cli send \
  --user-id 883624684520276 \
  --message "Is this still available?"
```

## Output Formats

### JSON (Default)
Structured data suitable for programmatic processing:
```json
{
  "listings": [
    {
      "id": "123456",
      "title": "Vintage Road Bike",
      "price": 200,
      "location": "San Francisco, CA",
      "seller": {"name": "John D."},
      "url": "https://facebook.com/marketplace/item/123456"
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
- **URL:** https://facebook.com/marketplace/item/123456
```

## Common Workflows

### Search and Contact Workflow
```bash
# 1. Search for items
facebook-cli search --query "laptop" --limit 5 --format json > results.json

# 2. Get details for interesting listing
facebook-cli listing --id <listing-id-from-results> --format markdown

# 3. List conversations to find seller
facebook-cli list --format json

# 4. Read conversation or send message
facebook-cli read --conversation-id <conv-id> --limit 10
facebook-cli send --user-id <user-id> --message "Is this still available?"
```

### Monitor New Listings
```bash
# Search with filters and process results
facebook-cli search \
  --query "vintage furniture" \
  --min-price 50 \
  --max-price 200 \
  --location "New York, NY" \
  --radius 10 \
  --format json | jq '.listings[] | {title, price, url}'
```

## Error Handling

Common issues and solutions:

1. **PIN Required**: Ensure `FACEBOOK_PIN` is set in `.env`
2. **Timeout Errors**: Use `--headed` flag to debug visually
3. **No Results**: Check location format or try broader search terms
4. **Login Failed**: Verify credentials in `.env` file

## Rate Limiting & Best Practices

- Built-in delays (1-5 seconds) between actions to avoid detection
- Session persistence reduces login frequency
- Use `--headed` only for debugging
- Respect Facebook's Terms of Service
- Consider using secondary account for automation

## Security Notes

- Credentials stored in `.env` (never commit this file)
- Session cookies stored in `~/.config/facebook-cli/sessions/`
- No credential logging in output
- Headless mode by default for security

## Dependencies

Requires:
- Node.js >= 18.0.0
- Playwright browsers (auto-installed)

## License

MIT License - See repository for details.
