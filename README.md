# Synn Bots

A modular WhatsApp bot built using Baileys and Node.js with ESM Hot-Reload support.

## Project Structure

- `bot.js`: Entry point of the bot application.
- `message.handler.js`: Main message handler that routes incoming messages to command modules. Includes the Hot Reload Engine.
- `libs/paths.js`: Centralized file path definitions. **Always use this** instead of `path.join(process.cwd(), ...)` to avoid path errors.
- `libs/database.js`: Core logic for managing user data (Coins, VIP status) safely with automatic migrations.
- `libs/configManager.js`: System to read, write, and safely persist global bot settings to `database/config.json`.
- `modules/`: Directory containing all bot commands. Modules are auto-loaded and support ESM Hot Reload.
- `database/`: Storage for JSON databases and persistent config files.
- `assets/`: Static assets.

## Hot Reloading (Safe ESM Auto Reload)

This project features a robust Hot-Reload system. You **do not** need to restart the bot when adding or editing commands.
- Editing any `.js` file inside `modules/` will automatically reload the command.
- If your new code has syntax errors, the bot **will not crash**. It will catch the error, log it, and safely rollback to the last working version of the handler.
- Deleting a module file will automatically unregister the command and its aliases from memory.

## Adding a New Command Module

To add a new command, simply create a `.js` file inside `modules/` (or any sub-folder like `modules/general/`).

### Minimal Module Template

```javascript
// Example: modules/general/ping.js

export const config = {
    name: 'ping',            // Main command name (required)
    aliases: ['p'],          // Array of alternative names (optional)
    description: 'Cek bot',  // Help description
    usage: '.ping',          // Usage example
    isOwner: false,          // Set to true if only bot owner can use it
    isAdmin: false,          // Set to true if only group admin can use it
    isGroup: false,          // Set to true if command only works in groups
};

// The execute function receives standard arguments
export const execute = async (sock, m, args, { reply, sender, command }) => {
    // Write your logic here
    await reply('Pong! 🏓');
};
```

## Centralized Path System (`libs/paths.js`)

Do not use `process.cwd()` to construct paths. Instead, import `libs/paths.js` to ensure the bot works perfectly regardless of where it is executed from.

```javascript
import paths from '../../libs/paths.js';
import fs from 'fs';
import { join } from 'path';

// Good practice
const myAsset = join(paths.assets, 'image.png');

// Bad practice
// const myAsset = join(process.cwd(), 'assets', 'image.png');
```

## Coin & VIP System

The bot features a secure, modular currency (Coins) and VIP membership system handled in `libs/database.js`.

- All functions automatically prevent negative coin balances.
- VIP days correctly stack if a user extends their VIP membership before it expires.

### Interacting with Coins & VIP in Modules
```javascript
import db from '../../libs/database.js';

// Get a normalized user ID
const userId = db.normalizeUserId(sender);

// Check Coin Balance
const user = db.getUser(userId);
console.log(user.coins); // Output: 100

// Add/Reduce Coins
db.addCoins(userId, 50);
const success = db.reduceCoins(userId, 20); // returns false if insufficient coins

// Manage VIP
db.addVipDays(userId, 30); // Adds 30 days of VIP
const isVip = db.isVip(userId); // returns boolean
```

## Persistent Configuration Management

Global bot settings are stored permanently in `database/config.json` via `libs/configManager.js`. You can update configs using the in-chat Admin command.

- **Usage:** `.setconfig <key> <value>`
- **Example:** `.setconfig botName "Super Bot"`
- **Example (Nested):** `.setconfig coins.vipPrice 50`

The bot dynamically updates settings without requiring a restart, and changes persist across reboots.
