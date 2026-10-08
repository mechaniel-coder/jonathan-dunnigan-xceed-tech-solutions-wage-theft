const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db     = require('../../database');
const config = require('../../config');

const STARS  = ['', '⭐', '⭐⭐', '⭐⭐⭐', '⭐⭐⭐⭐', '⭐⭐⭐⭐⭐'];
const COLORS = [config.errorColor, config.warnColor, 0xFFDD00, 0x88CC00, config.successColor];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('review')
    .setDescription('Leave a public review for Skyhigh Hosting')
    .addIntegerOption(o => o
      .setName('rating')
      .setDescription('Your rating out of 5')
      .setRequired(true)
      .setMinValue(1)
      .setMaxValue(5)
    )
    .addStringOption(o => o
      .setName('text')
      .setDescription('Your review (tell others about your experience)')
      .setRequired(true)
      .setMaxLength(1000)
    ),

  async execute(interaction) {
    const rating  = interaction.options.getInteger('rating');
    const text    = interaction.options.getString('text');
    const guildId = interaction.guild.id;

    const [settings] = await db.query(
      'SELECT reviews_channel FROM guild_settings WHERE guild_id = ?',
      [guildId]
    );

    if (!settings?.reviews_channel) {
      return interaction.reply({
        content: '❌ No reviews channel configured. Ask an admin to run `/setreviews`.',
        flags: 64,
      });
    }

    const channel = interaction.guild.channels.cache.get(settings.reviews_channel);
    if (!channel) {
      return interaction.reply({ content: '❌ The reviews channel no longer exists. Contact an admin.', flags: 64 });
    }

    const embed = new EmbedBuilder()
      .setTitle(`${STARS[rating]}  ${rating}/5 Stars`)
      .setDescription(text)
      .setColor(COLORS[rating - 1])
      .setAuthor({ name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL() })
      .setFooter({ text: 'Skyhigh Hosting — Customer Review' })
      .setTimestamp();

    const msg = await channel.send({ embeds: [embed] });

    await db.query(
      'INSERT INTO reviews (guild_id, user_id, rating, review_text, message_id) VALUES (?, ?, ?, ?, ?)',
      [guildId, interaction.user.id, rating, text, msg.id]
    );

    await interaction.reply({ content: `✅ Thank you for your review! It's been posted to ${channel}.`, flags: 64 });
  },
};
