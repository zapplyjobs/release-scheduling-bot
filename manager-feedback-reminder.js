const { Client, GatewayIntentBits } = require('discord.js');

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

const BOT_TOKEN = process.env.BOT_TOKEN;

const TECH_CHANNEL_ID = '1490290473695186966';
const MARKETING_CHANNEL_ID = '1497904126439198720';

const MESSAGE = `
📋 **Bi-Monthly Performance Review Reminder**

Please review your subordinates and provide:

• Score out of 10
• Short feedback

Example:
\`Shaheer S. - 7/10 - Could improve his speed.\`

Please submit reviews today. Thank you!
`;

client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);

  try {
    const techChannel = await client.channels.fetch(TECH_CHANNEL_ID);
    const marketingChannel = await client.channels.fetch(MARKETING_CHANNEL_ID);

    await techChannel.send(MESSAGE);
    await marketingChannel.send(MESSAGE);

    console.log('Reminder sent successfully');
  } catch (error) {
    console.error(error);
  }

  client.destroy();
  process.exit(0);
});

client.login(BOT_TOKEN);
