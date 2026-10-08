const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const config = require('../../config');

const EMOJIS = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣'];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('poll')
    .setDescription('Create a poll with up to 8 options')
    .addStringOption(o => o.setName('question').setDescription('The poll question').setRequired(true))
    .addStringOption(o => o.setName('option1').setDescription('Option 1').setRequired(true))
    .addStringOption(o => o.setName('option2').setDescription('Option 2').setRequired(true))
    .addStringOption(o => o.setName('option3').setDescription('Option 3'))
    .addStringOption(o => o.setName('option4').setDescription('Option 4'))
    .addStringOption(o => o.setName('option5').setDescription('Option 5'))
    .addStringOption(o => o.setName('option6').setDescription('Option 6'))
    .addStringOption(o => o.setName('option7').setDescription('Option 7'))
    .addStringOption(o => o.setName('option8').setDescription('Option 8')),

  async execute(interaction) {
    const question = interaction.options.getString('question');
    const options  = [];

    for (let i = 1; i <= 8; i++) {
      const opt = interaction.options.getString(`option${i}`);
      if (opt) options.push(opt);
    }

    const embed = new EmbedBuilder()
      .setTitle(`📊 ${question}`)
      .setDescription(options.map((o, i) => `${EMOJIS[i]}  ${o}`).join('\n\n'))
      .setColor(config.color)
      .setAuthor({ name: `Poll by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
      .setFooter({ text: 'React to cast your vote!' })
      .setTimestamp();

    await interaction.reply({ content: '✅ Poll posted!', flags: 64 });

    const msg = await interaction.channel.send({ embeds: [embed] });
    for (let i = 0; i < options.length; i++) {
      await msg.react(EMOJIS[i]);
    }
  },
};
