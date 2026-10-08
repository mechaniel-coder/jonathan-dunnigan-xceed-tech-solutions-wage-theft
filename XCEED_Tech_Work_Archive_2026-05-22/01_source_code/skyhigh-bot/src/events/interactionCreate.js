const { handleButton }     = require('../utils/buttonHandler');

module.exports = {
  name: 'interactionCreate',
  async execute(interaction, client) {

    // ── Slash commands ───────────────────────────────────────────────────────
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return;

      try {
        await command.execute(interaction, client);
      } catch (err) {
        console.error(`[Command] Error in /${interaction.commandName}:`, err);
        const payload = { content: '❌ An error occurred while running that command.', ephemeral: true };
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(payload).catch(() => {});
        } else {
          await interaction.reply(payload).catch(() => {});
        }
      }

    // ── Buttons ──────────────────────────────────────────────────────────────
    } else if (interaction.isButton()) {
      await handleButton(interaction, client).catch(err => {
        console.error('[Button] Error:', err);
      });
    }
  },
};
