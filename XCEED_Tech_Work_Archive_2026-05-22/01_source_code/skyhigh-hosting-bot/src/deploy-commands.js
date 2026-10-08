'use strict';

const { REST, Routes } = require('discord.js');
const fs   = require('fs');
const path = require('path');

const token = process.env.BOT_TOKEN;
if (!token) { console.error('[Deploy] BOT_TOKEN env var is not set.'); process.exit(1); }

// Load all command data objects
const commands = [];
const commandsPath = path.join(__dirname, 'commands');

for (const category of fs.readdirSync(commandsPath)) {
  const catPath = path.join(commandsPath, category);
  if (!fs.statSync(catPath).isDirectory()) continue;
  for (const file of fs.readdirSync(catPath).filter(f => f.endsWith('.js'))) {
    const cmd = require(path.join(catPath, file));
    if (cmd.data) {
      commands.push(cmd.data.toJSON());
      console.log(`  + ${cmd.data.name}`);
    }
  }
}

const rest = new REST({ version: '10' }).setToken(token);

(async () => {
  let clientId;

  // Step 1: fetch app ID
  try {
    const app = await rest.get(Routes.oauth2CurrentApplication());
    clientId  = app.id;
    console.log(`\n[Deploy] App ID: ${clientId}`);
  } catch (err) {
    console.error('[Deploy] Failed to fetch application info:', err.code, err.status, err.message);
    process.exit(1);
  }

  // Step 2: clear guild-specific commands (removes duplicates that appear alongside global ones)
  const guildId = process.env.GUILD_ID;
  if (guildId) {
    try {
      await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: [] });
      console.log(`[Deploy] Cleared guild-specific commands for guild ${guildId}.`);
    } catch (err) {
      console.warn('[Deploy] Could not clear guild commands (non-fatal):', err.message);
    }
  }

  // Step 3: register commands globally
  try {
    console.log(`[Deploy] Registering ${commands.length} global slash commands...`);
    const data = await rest.put(Routes.applicationCommands(clientId), { body: commands });
    console.log(`[Deploy] Successfully registered ${data.length} commands.`);
  } catch (err) {
    console.error('[Deploy] Failed to register commands:', err.code, err.status, err.message);
    process.exit(1);
  }
})();
