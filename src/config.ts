import 'dotenv/config';

export const TOKEN = process.env.DISCORD_TOKEN!;
export const APP_ID = process.env.APPLICATION_ID!;
export const DEV_GUILD_ID = process.env.GUILD_ID; // optional

if (!TOKEN || !APP_ID) {
  console.error('Bitte DISCORD_TOKEN und APPLICATION_ID in .env setzen.');
  process.exit(1);
}
