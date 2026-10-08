'use strict';
const { SlashCommandBuilder } = require('discord.js');
const db = require('../../database');
const { buildComponents } = require('../../utils/rolePanelManager');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('getroles')
    .setDescription('Open the role picker — only you can see it'),

  async execute(interaction) {
    await interaction.deferReply({ flags: 64 });

    const [settings] = await db.query(
      'SELECT role_picker_panel_id FROM guild_settings WHERE guild_id = ?',
      [interaction.guild.id]
    ).catch(() => []);

    const panelId = settings?.role_picker_panel_id;
    if (!panelId) {
      return interaction.editReply(
        '❌ No role picker has been configured. Ask an admin to use `/onboarding setpickerpanel`.'
      );
    }

    const buttons = await db.query(
      'SELECT * FROM role_panel_buttons WHERE panel_id = ? ORDER BY id ASC',
      [panelId]
    ).catch(() => []);

    if (!buttons.length) {
      return interaction.editReply('❌ The role picker has no roles configured yet.');
    }

    const components = buildComponents(buttons);
    return interaction.editReply({
      content: '🎭 **Pick your roles below.** Click a button to add or remove a role.',
      components,
    });
  },
};
