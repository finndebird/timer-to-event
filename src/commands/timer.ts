import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  ChannelType,
  TextChannel,
} from 'discord.js';
import { DateTime, Duration } from 'luxon';
import { db } from '../db.js';
import {
  computeInitialPlan,
  formatRelHours,
  parseEventDate,
  parseInterval,
  ID,
} from '../time.js';

export const timerCommand = new SlashCommandBuilder()
  .setName('timer')
  .setDescription('Timer verwalten')
  .addSubcommand((sc) =>
    sc
      .setName('create')
      .setDescription('Timer anlegen und regelmäßig vorher erinnern')
      .addStringOption((o) =>
        o
          .setName('date')
          .setDescription('DD.MM.YYYY-HH:MM (Europe/Berlin)')
          .setRequired(true)
      )
      .addStringOption((o) =>
        o
          .setName('remind')
          .setDescription('Intervall, z.B. 12h oder 12:00:00h')
          .setRequired(true)
      )
      .addChannelOption((o) =>
        o
          .setName('channel')
          .setDescription('Zielkanal (Standard: aktueller Channel)')
          .addChannelTypes(ChannelType.GuildText)
      )
      .addStringOption((o) =>
        o
          .setName('message')
          .setDescription(
            'Optionale Nachricht, die bei jeder Erinnerung gesendet wird'
          )
      )
  )
  .addSubcommand((sc) =>
    sc
      .setName('remove')
      .setDescription('Timer für ein Datum entfernen')
      .addStringOption((o) =>
        o
          .setName('date')
          .setDescription('DD.MM.YYYY-HH:MM (Europe/Berlin)')
          .setRequired(true)
      )
      .addChannelOption((o) =>
        o
          .setName('channel')
          .setDescription('Kanal (Standard: aktueller Channel)')
          .addChannelTypes(ChannelType.GuildText)
      )
  )
  .addSubcommand((sc) =>
    sc
      .setName('list')
      .setDescription('Geplante Timer anzeigen')
      .addChannelOption((o) =>
        o
          .setName('channel')
          .setDescription('Kanal (Standard: aktueller Channel)')
          .addChannelTypes(ChannelType.GuildText)
      )
  );

export async function handleTimer(inter: ChatInputCommandInteraction) {
  const sub = inter.options.getSubcommand();

  if (sub === 'create') {
    const dateStr = inter.options.getString('date', true);
    const remindStr = inter.options.getString('remind', true);
    const channel = (inter.options.getChannel('channel') ??
      inter.channel) as TextChannel | null;
    const customMsg = inter.options.getString('message') ?? undefined;

    if (!channel || channel.type !== ChannelType.GuildText) {
      return inter.reply({
        content: 'Bitte einen Textkanal angeben.',
        ephemeral: true,
      });
    }
    if (!inter.guildId) {
      return inter.reply({
        content: 'Dieser Befehl funktioniert nur in Servern.',
        ephemeral: true,
      });
    }

    const eventLocal = parseEventDate(dateStr);
    if (!eventLocal.isValid) {
      return inter.reply({
        content:
          '❌ Ungültiges Datum. Format: `dd.MM.yyyy-HH:mm` (z. B. `20.09.2025-10:00`).',
        ephemeral: true,
      });
    }
    const eventUtc = eventLocal
      .setZone('Europe/Berlin', { keepLocalTime: true })
      .toUTC();
    const eventUtcMs = eventUtc.toMillis();

    const interval = parseInterval(remindStr);
    const intervalMs = Math.max(interval.toMillis(), 1000);
    const nowMs = DateTime.utc().toMillis();

    if (eventUtcMs <= nowMs) {
      return inter.reply({
        content: '❌ Das Datum liegt in der Vergangenheit.',
        ephemeral: true,
      });
    }

    const { remaining, next } = computeInitialPlan(
      eventUtcMs,
      intervalMs,
      nowMs
    );
    if (remaining <= 0 || !next) {
      return inter.reply({
        content:
          '⚠️ Zwischen jetzt und dem Event liegt weniger als ein Intervall – es gäbe keine Erinnerungen.',
        ephemeral: true,
      });
    }

    const id = ID();
    try {
      db.prepare(
        `
        INSERT INTO timers (id, guildId, channelId, createdBy, eventTimeMs, intervalMs, nextReminderAtMs, remainingIntervals, message, createdAtMs)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `
      ).run(
        id,
        inter.guildId,
        channel.id,
        inter.user.id,
        eventUtcMs,
        intervalMs,
        next,
        remaining,
        customMsg ?? null,
        nowMs
      );
    } catch (e: any) {
      if (e.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        return inter.reply({
          content:
            '❌ Für dieses Datum existiert in diesem Kanal bereits ein Timer.',
          ephemeral: true,
        });
      }
      throw e;
    }

    const nextInMs = next - nowMs;
    const nextInRoundedMs = Math.round(nextInMs / 60_000) * 60_000;
    const nextIn = Duration.fromMillis(nextInRoundedMs)
      .shiftTo('days', 'hours', 'minutes')
      .toHuman({ unitDisplay: 'short' });
    await inter.reply(
      `✅ Timer angelegt für **${eventLocal.toFormat(
        'dd.MM.yyyy HH:mm'
      )} (Europe/Berlin)**.\n` +
        `Erinnerungsintervall: **${formatRelHours(intervalMs)}**.\n` +
        `Nächste Erinnerung in ~ **${nextIn}** im Kanal ${channel}.`
    );
  }

  if (sub === 'remove') {
    const dateStr = inter.options.getString('date', true);
    const channel = (inter.options.getChannel('channel') ??
      inter.channel) as TextChannel | null;
    if (!channel || channel.type !== ChannelType.GuildText) {
      return inter.reply({
        content: 'Bitte einen Textkanal angeben.',
        ephemeral: true,
      });
    }
    if (!inter.guildId) {
      return inter.reply({
        content: 'Dieser Befehl funktioniert nur in Servern.',
        ephemeral: true,
      });
    }

    const eventLocal = parseEventDate(dateStr);
    if (!eventLocal.isValid) {
      return inter.reply({
        content: '❌ Ungültiges Datum. Format: `dd.MM.yyyy-HH:mm`.',
        ephemeral: true,
      });
    }
    const eventUtcMs = eventLocal
      .setZone('Europe/Berlin', { keepLocalTime: true })
      .toUTC()
      .toMillis();

    const res = db
      .prepare(
        `
      DELETE FROM timers
      WHERE guildId = ? AND channelId = ? AND eventTimeMs = ?
      `
      )
      .run(inter.guildId, channel.id, eventUtcMs);

    if (res.changes === 0) {
      return inter.reply({
        content: 'ℹ️ Kein passender Timer gefunden.',
        ephemeral: true,
      });
    }
    return inter.reply(
      `🗑️ Timer für **${eventLocal.toFormat(
        'dd.MM.yyyy HH:mm'
      )}** in ${channel} gelöscht.`
    );
  }

  if (sub === 'list') {
    const channel = (inter.options.getChannel('channel') ??
      inter.channel) as TextChannel | null;
    if (!channel || channel.type !== ChannelType.GuildText) {
      return inter.reply({
        content: 'Bitte einen Textkanal angeben.',
        ephemeral: true,
      });
    }
    if (!inter.guildId) {
      return inter.reply({
        content: 'Dieser Befehl funktioniert nur in Servern.',
        ephemeral: true,
      });
    }

    const rows = db
      .prepare(
        `
        SELECT id, createdBy, eventTimeMs, intervalMs, nextReminderAtMs, remainingIntervals, message, createdAtMs
        FROM timers
        WHERE guildId = ? AND channelId = ?
        ORDER BY eventTimeMs ASC
        `
      )
      .all(inter.guildId, channel.id) as any[];

    if (rows.length === 0) {
      return inter.reply({
        content: 'ℹ️ Keine Timer in diesem Kanal.',
        ephemeral: true,
      });
    }

    const now = DateTime.utc().toMillis();
    const lines = rows.map((t, idx) => {
      const whenLocal = DateTime.fromMillis(t.eventTimeMs)
        .toUTC()
        .setZone('Europe/Berlin');
      const nextInMs = (t.nextReminderAtMs ?? t.eventTimeMs) - now;
      const nextHuman =
        nextInMs > 0
          ? Duration.fromMillis(Math.round(nextInMs / 60_000) * 60_000)
              .shiftTo('days', 'hours', 'minutes')
              .toHuman({ unitDisplay: 'short' })
          : 'bald';
      const createdBy = `<@${t.createdBy}>`;
      const hasMsg = typeof t.message === 'string' && t.message.length > 0;
      const msgSnippet = hasMsg
        ? ` — "${String(t.message).slice(0, 60)}${
            String(t.message).length > 60 ? '…' : ''
          }"`
        : '';
      return `${idx + 1}. ${whenLocal.toFormat(
        'dd.MM.yyyy HH:mm'
      )} — Intervall ${formatRelHours(
        t.intervalMs
      )} — nächste Erinnerung in ~ ${nextHuman} — von ${createdBy}${msgSnippet}`;
    });

    const header = `📋 Timer in ${channel} (${rows.length}):`;
    const content = [header, ...lines].join('\n');
    return inter.reply({ content, ephemeral: true });
  }
}
