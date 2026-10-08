'use strict';

const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const db     = require('../database');
const config = require('../config');

const styleMap = {
  Primary:   ButtonStyle.Primary,
  Secondary: ButtonStyle.Secondary,
  Success:   ButtonStyle.Success,
  Danger:    ButtonStyle.Danger,
};

/** Build ActionRows of buttons from a list of panel button rows. */
function buildComponents(buttons) {
  const rows = [];
  for (let i = 0; i < buttons.length; i += 5) {
    const row = new ActionRowBuilder();
    for (const btn of buttons.slice(i, i + 5)) {
      const b = new ButtonBuilder()
        .setCustomId(`role_toggle_${btn.role_id}`)
        .setLabel(btn.label)
        .setStyle(styleMap[btn.style] || ButtonStyle.Primary);
      if (btn.emoji) {
        try { b.setEmoji(btn.emoji); } catch {}
      }
      row.addComponents(b);
    }
    rows.push(row);
  }
  return rows;
}

/** Build the embed for a panel. */
function buildEmbed(panel) {
  return new EmbedBuilder()
    .setTitle(panel.title)
    .setDescription(panel.description || 'Click a button below to assign or remove a role.\nClicking the same button again removes the role.')
    .setColor(config.color)
    .setFooter({ text: `Panel ID: ${panel.id}` });
}

/**
 * Post or edit the panel message in Discord.
 * If panel.message_id exists, tries to edit; falls back to a new post.
 */
async function postPanel(client, panel, buttons) {
  const guild = client.guilds.cache.get(panel.guild_id);
  if (!guild) return;

  const channel = guild.channels.cache.get(panel.channel_id);
  if (!channel) return;

  const embed      = buildEmbed(panel);
  const components = buildComponents(buttons);

  if (panel.message_id) {
    try {
      const existing = await channel.messages.fetch(panel.message_id);
      await existing.edit({ embeds: [embed], components });
      return;
    } catch {
      // Message was deleted — fall through to post a new one
    }
  }

  const msg = await channel.send({ embeds: [embed], components });
  await db.query('UPDATE role_panels SET message_id = ? WHERE id = ?', [msg.id, panel.id]);
  // Update in-place so caller has fresh message_id
  panel.message_id = msg.id;
}

module.exports = { postPanel, buildComponents, buildEmbed };
