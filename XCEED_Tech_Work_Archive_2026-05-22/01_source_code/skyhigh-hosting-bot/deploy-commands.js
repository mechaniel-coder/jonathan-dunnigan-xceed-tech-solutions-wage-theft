require('dotenv').config();
const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');

const commands = [];
const commandsPath = path.join(__dirname, 'src', 'commands');

for (const category of fs.readdirSync(commandsPath)) {
  const categoryPath = path.join(commandsPath, category);
  if (!fs.statSync(categoryPath).isDirectory()) continue;
  for (const file of fs.readdirSync(categoryPath).filter(f => f.endsWith('.js'))) {
    const cmd = require(path.join(categoryPath, file));
    if (cmd.data) commands.push(cmd.data.toJSON());
  }
}

const rest = new REST().setToken(process.env.BOT_TOKEN);

(async () => {
  try {
    // Auto-detect application ID from the bot token so CLIENT_ID in .env is not needed
    const app = await rest.get(Routes.oauth2CurrentApplication());
    const clientId = app.id;
    console.log(`Deploying ${commands.length} slash commands... (App ID: ${clientId})`);
    const data = await rest.put(
      Routes.applicationGuildCommands(clientId, process.env.GUILD_ID),
      { body: commands }
    );
    console.log(`✅ Successfully deployed ${data.length} commands to guild ${process.env.GUILD_ID}`);
  } catch (err) {
    console.error('❌ Deploy failed:', err);
  }
})();
