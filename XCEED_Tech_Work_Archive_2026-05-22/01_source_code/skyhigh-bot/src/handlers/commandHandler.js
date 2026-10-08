const fs   = require('fs');
const path = require('path');

function loadCommands(client) {
  const commandsPath = path.join(__dirname, '../commands');
  let count = 0;

  for (const category of fs.readdirSync(commandsPath)) {
    const categoryPath = path.join(commandsPath, category);
    if (!fs.statSync(categoryPath).isDirectory()) continue;

    for (const file of fs.readdirSync(categoryPath).filter(f => f.endsWith('.js'))) {
      const command = require(path.join(categoryPath, file));
      if (command.data && command.execute) {
        client.commands.set(command.data.name, command);
        count++;
      } else {
        console.warn(`[Commands] Skipping ${file} — missing data or execute.`);
      }
    }
  }

  console.log(`[Commands] Loaded ${count} commands.`);
}

module.exports = { loadCommands };
