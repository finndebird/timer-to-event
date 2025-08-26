import { REST, Routes } from 'discord.js';
import { APP_ID, DEV_GUILD_ID, TOKEN } from '../config.js';
import { timerCommand } from './timer.js';

export const allSlashCommands = [timerCommand];

export async function registerSlashCommands() {
  const rest = new REST({ version: '10' }).setToken(TOKEN);
  const body = allSlashCommands.map((c) => c.toJSON());
  if (DEV_GUILD_ID) {
    await rest.put(Routes.applicationGuildCommands(APP_ID, DEV_GUILD_ID), {
      body,
    });
    console.log('Slash-Commands (Guild) registriert.');
  } else {
    await rest.put(Routes.applicationCommands(APP_ID), { body });
    console.log('Slash-Commands (Global) registriert (kann etwas dauern).');
  }
}
