import { ChannelType, Client, TextChannel } from 'discord.js';
import { DateTime } from 'luxon';
import { db } from './db.js';

export function startScheduler(client: Client, intervalMs = 30_000) {
  async function tick() {
    const now = DateTime.utc().toMillis();

    const due = db
      .prepare(
        `
        SELECT * FROM timers
        WHERE nextReminderAtMs IS NOT NULL
          AND nextReminderAtMs <= ?
          AND eventTimeMs > ?
        ORDER BY nextReminderAtMs ASC
        LIMIT 50
        `
      )
      .all(now, now);

    for (const t of due as any[]) {
      try {
        const guild = await client.guilds.fetch(t.guildId);
        const channel = await guild.channels.fetch(t.channelId);
        if (!channel || channel.type !== ChannelType.GuildText) {
          db.prepare(`DELETE FROM timers WHERE id = ?`).run(t.id);
          continue;
        }

        const remainingH = Math.round(
          (t.eventTimeMs - t.nextReminderAtMs) / (60 * 60 * 1000)
        );
        const whenLocal = DateTime.fromMillis(t.eventTimeMs)
          .toUTC()
          .setZone('Europe/Berlin');
        const msg = t.message ? `\n${t.message}` : '';

        await (channel as TextChannel).send(
          `⏰ Erinnerung: Event am **${whenLocal.toFormat(
            'dd.MM.yyyy HH:mm'
          )}** ` + `(noch ~${remainingH}h).${msg}`
        );

        const newRemaining = t.remainingIntervals - 1;
        if (newRemaining <= 0) {
          db.prepare(`DELETE FROM timers WHERE id = ?`).run(t.id);
        } else {
          const newNext = t.eventTimeMs - newRemaining * t.intervalMs;
          let adjustedRemaining = newRemaining;
          let adjustedNext = newNext;
          while (adjustedRemaining > 0 && adjustedNext <= now) {
            adjustedRemaining -= 1;
            adjustedNext = t.eventTimeMs - adjustedRemaining * t.intervalMs;
          }
          if (adjustedRemaining <= 0) {
            db.prepare(`DELETE FROM timers WHERE id = ?`).run(t.id);
          } else {
            db.prepare(
              `
              UPDATE timers
              SET remainingIntervals = ?, nextReminderAtMs = ?
              WHERE id = ?
              `
            ).run(adjustedRemaining, adjustedNext, t.id);
          }
        }
      } catch (err) {
        console.error('Send/Update error:', err);
      }
    }
  }

  setInterval(tick, intervalMs);
}
