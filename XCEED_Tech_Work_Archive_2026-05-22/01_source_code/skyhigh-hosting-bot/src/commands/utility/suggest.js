const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db     = require('../../database');
const config = require('../../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('suggest')
    .setDescription('Submit a suggestion for the server or service')
    .addStringOption(o => o
      .setName('suggestion')
      .setDescription('Your suggestion (be descriptive!)')
      .setRequired(true)
      .setMaxLength(1000)
    ),

  async execute(interaction) {
    const suggestion = interaction.options.getString('suggestion');
    const guildId    = interaction.guild.id;

    const [settings] = await db.query(
      'SELECT suggestions_channel FROM guild_settings WHERE guild_id = ?',
      [guildId]
    );

    if (!settings?.suggestions_channel) {
      return interaction.reply({
        content: '❌ No suggestions channel configured. Ask an admin to run `/setsuggestions`.',
        flags: 64,
      });
    }

    const channel = interaction.guild.channels.cache.get(settings.suggestions_channel);
    if (!channel) {
      return interaction.reply({ content: '❌ The suggestions channel no longer exists. Contact an admin.', flags: 64 });
    }

    const embed = new EmbedBuilder()
      .setTitle('💡 New Suggestion')
      .setDescription(suggestion)
      .setColor(config.color)
      .setAuthor({ name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL() })
      .setFooter({ text: 'React with 👍 or 👎 to vote!' })
      .setTimestamp();

    const msg = await channel.send({ embeds: [embed] });
    await msg.react('👍');
    await msg.react('👎');

    await db.query(
      'INSERT INTO suggestions (guild_id, user_id, suggestion_text, message_id) VALUES (?, ?, ?, ?)',
      [guildId, interaction.user.id, suggestion, msg.id]
    );

    await interaction.reply({ content: `✅ Your suggestion has been posted to ${channel}!`, flags: 64 });
  },
};
