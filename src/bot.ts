import 'dotenv/config';
import { Client, GatewayIntentBits } from 'discord.js';
import { TOKEN } from './config.js';
import { registerSlashCommands } from './commands/index.js';
import { startScheduler } from './scheduler.js';
import { handleTimer } from './commands/timer.js';

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('ready', () => {
  console.log(`Logged in as ${client.user?.tag}`);
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  try {
    if (interaction.commandName === 'timer') {
      await handleTimer(interaction);
    }
  } catch (err: any) {
    console.error(err);
    if (interaction.deferred || interaction.replied) {
      await interaction.followUp({
        content: `❌ Fehler: ${err.message ?? 'unbekannt'}`,
        ephemeral: true,
      });
    } else {
      await interaction.reply({
        content: `❌ Fehler: ${err.message ?? 'unbekannt'}`,
        ephemeral: true,
      });
    }
  }
});

(async () => {
  await registerSlashCommands();
  startScheduler(client, 30_000);
  await client.login(TOKEN);
  console.log('Bot gestartet.');
})();
