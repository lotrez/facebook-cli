# Facebook CLI - Agent Context

## Project Overview
A headless CLI tool built with Bun for exploring Facebook Marketplace and interacting with users via Messenger using browser automation (Playwright).

## Technology Stack
- **Runtime**: Bun (latest)
- **CLI Framework**: @bunli/core
- **Browser Automation**: Playwright with stealth plugins
- **Authentication**: Auto-login with credentials from .env
- **Testing**: Bun's built-in test runner with actual browser tests
- **Output Formats**: JSON and Markdown (for LLM consumption)

## Architecture

### Commands
```
facebook-cli marketplace search <query> [options]
  --location, -l    Location string (e.g., "San Francisco, CA")
  --radius, -r      Search radius in miles (default: 20)
  --min-price       Minimum price
  --max-price       Maximum price
  --category        Category filter
  --limit           Maximum results (default: 20)
  --format          Output format: json | markdown (default: json)

facebook-cli marketplace listing <id>
  --format          Output format: json | markdown

facebook-cli messages list
  --limit           Maximum conversations (default: 20)
  --format          Output format: json | markdown

facebook-cli messages send <user-id> <message>

facebook-cli messages read <conversation-id>
  --limit           Maximum messages (default: 50)
  --format          Output format: json | markdown
```

### Auto-Login Flow
1. Check for valid session cookies in ~/.config/facebook-cli/sessions/
2. If expired/missing, login automatically using FACEBOOK_EMAIL and FACEBOOK_PASSWORD from .env
3. Save new session cookies for reuse
4. Continue with command execution

### Anti-Detection Measures
- Playwright with puppeteer-extra-plugin-stealth
- Random delays (1-5 seconds) between actions
- Human-like scrolling behavior
- Session persistence to reduce login frequency
- User agent rotation

## Environment Variables
```bash
FACEBOOK_EMAIL=          # Facebook login email
FACEBOOK_PASSWORD=       # Facebook login password
FACEBOOK_SESSION_DIR=    # Session storage path (default: ~/.config/facebook-cli/sessions)
FACEBOOK_HEADLESS=       # true | false (default: true)
FACEBOOK_SLOW_MO=        # Slow motion delay in ms for debugging (default: 0)
```

## Code Conventions
- Use TypeScript with strict mode
- All browser automation code in src/lib/
- All CLI commands in src/commands/
- Use Zod for validation
- Prefer async/await over promises
- Use early returns to reduce nesting
- Test files co-located with source files (*.test.ts)

## Testing Requirements
- Use Bun's built-in test runner
- Tests must use actual browser automation
- Mock external APIs but not Facebook itself
- Include integration tests for critical paths
- Test authentication flow with test credentials
- All commands must have corresponding tests

## Output Formats

### JSON (Default)
Structured data suitable for programmatic use and LLM processing.

### Markdown
Human-readable format optimized for LLM consumption with clear headers and structured content.

## File Structure
```
src/
  commands/
    marketplace.ts      # Marketplace commands
    messages.ts         # Messenger commands
  lib/
    browser.ts          # Playwright browser manager
    auth.ts             # Authentication & session handling
    marketplace.ts      # Marketplace scraping logic
    messenger.ts        # Messenger automation
    utils.ts            # Utility functions
  types/
    index.ts            # TypeScript type definitions
  config.ts             # Configuration management
  index.ts              # CLI entry point
```

## Linting & Type Checking
- Use `bun run lint` if available
- Use `bun run typecheck` if available
- Otherwise use `tsc --noEmit` for type checking

## Build Commands
- `bun install` - Install dependencies
- `bun run dev` - Development mode
- `bun run build` - Build for production
- `bun test` - Run all tests
- `bun test --watch` - Run tests in watch mode

## Security Notes
- Credentials stored in .env (not committed)
- Sessions stored in user's home directory
- No credential logging or exposure
