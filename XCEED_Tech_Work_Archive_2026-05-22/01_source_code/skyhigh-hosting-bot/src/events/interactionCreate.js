const { handleButton, handleModal } = require('../utils/buttonHandler');
const { auditLog }     = require('../utils/auditLog');
const { EmbedBuilder } = require('discord.js');
const config           = require('../config');

module.exports = {
  name: 'interactionCreate',
  async execute(interaction, client) {

    // ── Slash commands ───────────────────────────────────────────────────────
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return;

      // Log every slash command used to the audit log channel
      if (interaction.guild) {
        const sub    = interaction.options?.getSubcommand?.(false);
        const cmdStr = sub ? `/${interaction.commandName} ${sub}` : `/${interaction.commandName}`;
        const embed  = new EmbedBuilder()
          .setTitle('⌨️ Command Used')
          .addFields(
            { name: 'Command', value: `\`${cmdStr}\``,                                              inline: true },
            { name: 'User',    value: `${interaction.user.tag} (${interaction.user.id})`,           inline: true },
            { name: 'Channel', value: interaction.channel ? `${interaction.channel}` : 'Unknown',  inline: true },
          )
          .setColor(config.color)
          .setTimestamp();
        auditLog(interaction.guild, embed).catch(() => {});
      }

      try {
        await command.execute(interaction, client);
      } catch (err) {
        console.error(`[Command] Error in /${interaction.commandName}:`, err);
        const payload = { content: '❌ An error occurred while running that command.', flags: 64 };
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

    // ── Modals ───────────────────────────────────────────────────────────────
    } else if (interaction.isModalSubmit()) {
      await handleModal(interaction).catch(err => {
        console.error('[Modal] Error:', err);
      });
    }
  },
};
