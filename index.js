const { Client, GatewayIntentBits } = require('discord.js');
const cron = require('node-cron');

const client = new Client({ 
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] 
});

// === CONFIGURATION ===
const BOT_TOKEN = 'MTQ2MTk2Nzc3OTIwMzY0OTczNQ.G49TTb.wIV0IXwwlpIg28u5MNh6Q9ZD-WUeXCHoVKxXkI'; // Paste your token
const CHANNEL_ID = '1452477431096152196'; // Channel where threads are created
const TECH_CHANNEL_ID = '1371178076893085846'; // Tech channel for @everyone pings
const START_DATE = new Date('2026-01-19'); // Monday R1W1 starts - change this to move release start

// === TRACKING ===
function getReleasesForDate(date) {
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  const weeksSinceStart = Math.floor((date - START_DATE) / msPerWeek);
  
  if (weeksSinceStart < 0) return [];
  
  const releases = [];
  
  // Check which releases are active (each release = 4 weeks, new one starts every 2 weeks)
  for (let r = 1; r <= 100; r++) {
    const releaseStartWeek = (r - 1) * 2; // R1 starts week 0, R2 starts week 2, etc.
    const releaseEndWeek = releaseStartWeek + 3; // Each release lasts 4 weeks
    
    if (weeksSinceStart >= releaseStartWeek && weeksSinceStart <= releaseEndWeek) {
      const week = weeksSinceStart - releaseStartWeek + 1;
      releases.push({ release: r, week: week });
    }
  }
  
  return releases;
}

async function createThreads() {
  const channel = await client.channels.fetch(CHANNEL_ID);
  const techChannel = await client.channels.fetch(TECH_CHANNEL_ID);
  const today = new Date();
  const releases = getReleasesForDate(today);
  
  for (const { release, week } of releases) {
    // Only create thread on week 1 of each release
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
  
  console.log('Active releases:', releases.map(r => `R${r.release}W${r.week}`).join(', '));
}

// Run every Monday at 9am Pakistan time
cron.schedule('0 9 * * 1', () => {
  console.log('Running scheduled thread creation...');
  createThreads();
}, {
  timezone: 'Asia/Karachi'
});

client.once('ready', async () => {
  console.log(`Bot is online as ${client.user.tag}`);
  console.log(`Start date: ${START_DATE.toDateString()}`);
  console.log(`Current active releases:`, getReleasesForDate(new Date()));
  
  // TEST: Create a thread immediately - REMOVE THIS AFTER TESTING
  const channel = await client.channels.fetch(CHANNEL_ID);
  const techChannel = await client.channels.fetch(TECH_CHANNEL_ID);
  const thread = await channel.threads.create({
    name: 'R1W1-TEST 🪼',
    autoArchiveDuration: 10080,
    reason: 'Test thread'
  });
  await thread.send('🚀 **New release thread started!**');
  await techChannel.send(`@everyone New thread created: ${thread}`);
  console.log('Test thread created!');
});

client.login(BOT_TOKEN);