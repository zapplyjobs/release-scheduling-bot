const { Client, GatewayIntentBits } = require('discord.js');
const cron = require('node-cron');
const client = new Client({ 
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] 
});

// === CONFIGURATION ===
const BOT_TOKEN = process.env.BOT_TOKEN || 'REPLACE_WITH_TOKEN_FOR_LOCAL_TESTING';
const CHANNEL_ID = '1452477431096152196';
const TECH_CHANNEL_ID = '1371178076893085846';
const START_DATE = new Date('2026-01-22'); // Thursday - must align with Thursday cron schedule

// Week descriptions
const weekDescriptions = {
  1: 'Dev',
  2: 'Dev + QA',
  3: 'QA',
  4: 'Launch 🚀'
};

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

async function threadExists(channel, release, week) {
  const activeThreads = await channel.threads.fetchActive();
  for (const [id, thread] of activeThreads.threads) {
    if (thread.name.includes(`R${release}W${week}`)) {
      return true;
    }
  }
  
  const archivedThreads = await channel.threads.fetchArchived({ limit: 50 });
  for (const [id, thread] of archivedThreads.threads) {
    if (thread.name.includes(`R${release}W${week}`)) {
      return true;
    }
  }
  
  return false;
}

async function createThreads() {
  const channel = await client.channels.fetch(CHANNEL_ID);
  const techChannel = await client.channels.fetch(TECH_CHANNEL_ID);
  const today = new Date();
  const releases = getReleasesForDate(today);
  
  for (const { release, week } of releases) {
    const phase = weekDescriptions[week];
    const threadName = `R${release}W${week} 🐙`;
    
    // Skip if this thread already exists
    const alreadyExists = await threadExists(channel, release, week);
    if (alreadyExists) {
      console.log(`Thread ${threadName} already exists, skipping.`);
      continue;
    }
    
    // Create a new thread for every release+week combo
    const thread = await channel.threads.create({
      name: threadName,
      autoArchiveDuration: 10080,
      reason: `Release ${release} - Week ${week} thread`
    });
    
    await thread.send(
      `🚀 **Release ${release} — Week ${week}: ${phase}**\n\n` +
      `📅 This thread covers R${release}W${week}.\n` +
      `Phase: **${phase}**`
    );
    
    await techChannel.send(`@everyone New thread created: ${thread}`);
    console.log(`Created thread: ${threadName}`);
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
  console.log('Current active releases:', getReleasesForDate(new Date()));
});

client.login(BOT_TOKEN);
