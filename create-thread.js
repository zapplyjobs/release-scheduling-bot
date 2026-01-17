const { Client, GatewayIntentBits } = require('discord.js');

const client = new Client({ 
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] 
});

// === CONFIGURATION ===
const BOT_TOKEN = process.env.BOT_TOKEN;
const CHANNEL_ID = '1452477431096152196';
const TECH_CHANNEL_ID = '1371178076893085846';
const START_DATE = new Date('2026-01-03');

// === TRACKING ===
function getReleasesForDate(date) {
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  const weeksSinceStart = Math.floor((date - START_DATE) / msPerWeek);
  
  if (weeksSinceStart < 0) return [];
  
  const releases = [];
  
  for (let r = 1; r <= 100; r++) {
    const releaseStartWeek = (r - 1) * 2;
    const releaseEndWeek = releaseStartWeek + 3;
    
    if (weeksSinceStart >= releaseStartWeek && weeksSinceStart <= releaseEndWeek) {
      const week = weeksSinceStart - releaseStartWeek + 1;
      releases.push({ release: r, week: week });
    }
  }
  
  return releases;
}

client.once('ready', async () => {
  console.log(`Bot is online as ${client.user.tag}`);
  
  const channel = await client.channels.fetch(CHANNEL_ID);
  const techChannel = await client.channels.fetch(TECH_CHANNEL_ID);
  const today = new Date();
  const releases = getReleasesForDate(today);
  
  console.log('Today:', today.toDateString());
  console.log('Releases to create:', releases);
  
  for (const { release, week } of releases) {
    if (week === 1) {
      const threadName = `R${release}W${week} 🪼`;
      
      const thread = await channel.threads.create({
        name: threadName,
        autoArchiveDuration: 10080,
        reason: 'Weekly release thread'
      });
      
      await thread.send(`🚀 **Release ${release}** has started!\n\nWeek 1: Dev`);
      await techChannel.send(`@everyone New thread created: ${thread}`);
      console.log(`Created thread: ${threadName}`);
    }
  }
  
  console.log('Done! Exiting...');
  client.destroy();
  process.exit(0);
});

client.login(BOT_TOKEN);