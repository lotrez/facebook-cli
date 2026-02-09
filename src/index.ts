#!/usr/bin/env bun
import { createCLI } from '@bunli/core';
import { searchCommand, listingCommand } from './commands/marketplace';
import { listCommand, readCommand, sendCommand } from './commands/messages';

async function main() {
  const cli = await createCLI({
    name: 'facebook-cli',
    description: 'CLI tool for Facebook Marketplace and Messenger',
    version: '1.0.0',
  });

  // Register marketplace commands
  cli.command(searchCommand);
  cli.command(listingCommand);

  // Register message commands  
  cli.command(listCommand);
  cli.command(readCommand);
  cli.command(sendCommand);

  await cli.run();
}

main().catch(console.error);
