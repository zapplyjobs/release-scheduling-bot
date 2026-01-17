const { Client, GatewayIntentBits } = require('discord.js');

const client = new Client({ 
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] 
});

// === CONFIGURATION ===
const BOT_TOKEN = process.env.BOT_TOKEN;
const CHANNEL_ID = '1452477431096152196';
const TECH_CHANNEL_ID = '1371178076893085846';
const START_DATE = new Date('2026-01-19');

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

async function findExistingThread(channel, release) {
  const activeThreads = await channel.threads.fetchActive();
  
  for (const [id, thread] of activeThreads.threads) {
    // Match thread name like "🐙 R2W1" for release 2
    if (thread.name.includes(`R${release}W1`) && !thread.name.includes('[ARCHIVED]')) {
      return thread;
    }
  }
  return null;
}

client.once('ready', async () => {
  console.log(`Bot is online as ${client.user.tag}`);
  
  const channel = await client.channels.fetch(CHANNEL_ID);
  const techChannel = await client.channels.fetch(TECH_CHANNEL_ID);
  const today = new Date();
  const releases = getReleasesForDate(today);
  
  console.log('Today:', today.toDateString());
  console.log('Active releases:', releases);
  
  for (const { release, week } of releases) {
    const phase = weekDescriptions[week];
    
    if (week === 1) {
      // Create new thread
      const threadName = `R${release}W1 🪼`;
      
      const thread = await channel.threads.create({
        name: threadName,
        autoArchiveDuration: 10080,
        reason: 'Weekly release thread'
      });
      
      await thread.send(`🚀 **Release ${release}** has started!\n\n📅 **Week ${week}:** ${phase}`);
      await techChannel.send(`@everyone New thread created: ${thread}`);
      console.log(`Created thread: ${threadName}`);
      
    } else {
      // Find existing thread and post update
      const thread = await findExistingThread(channel, release);
      
      if (thread) {
        await thread.send(`📢 **Week ${week} Update:** ${phase}`);
        console.log(`Posted Week ${week} update to R${release} thread`);
      } else {
        console.log(`Could not find thread for R${release} to post Week ${week} update`);
      }
    }
  }
  
  console.log('Done! Exiting...');
  client.destroy();
  process.exit(0);
});

client.login(BOT_TOKEN);