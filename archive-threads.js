const { Client, GatewayIntentBits } = require('discord.js');
const client = new Client({ 
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] 
});

// === CONFIGURATION ===
const BOT_TOKEN = process.env.BOT_TOKEN;
const CHANNEL_ID = '1452477431096152196';
const START_DATE = new Date('2026-01-22'); // Thursday - must align with Thursday cron schedule

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

// Get releases that just finished (were in Week 4 last week)
function getCompletedReleases(date) {
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  const lastWeek = new Date(date.getTime() - msPerWeek);
  const lastWeekReleases = getReleasesForDate(lastWeek);
  
  // Return releases that were in Week 4 last week
  return lastWeekReleases.filter(r => r.week === 4).map(r => r.release);
}

client.once('ready', async () => {
  console.log(`Bot is online as ${client.user.tag}`);
  
  const channel = await client.channels.fetch(CHANNEL_ID);
  const today = new Date();
  const completedReleases = getCompletedReleases(today);
  
  console.log('Today:', today.toDateString());
  console.log('Releases to archive (finished Week 4):', completedReleases);
  
  if (completedReleases.length === 0) {
    console.log('No releases to archive this week.');
    client.destroy();
    process.exit(0);
    return;
  }
  
  // Fetch active threads
  const activeThreads = await channel.threads.fetchActive();
  console.log(`Found ${activeThreads.threads.size} active threads`);
  
  for (const [id, thread] of activeThreads.threads) {
    console.log(`Checking thread: ${thread.name}`);
    
    // Skip if already archived
    if (thread.archived) {
      console.log(`Skipped ${thread.name} - already archived`);
      continue;
    }
    
    // Skip if already marked as archived
    if (thread.name.includes('📦') || thread.name.includes('[ARCHIVED]')) {
      console.log(`Skipped ${thread.name} - already marked archived`);
      continue;
    }
    
    // Check if this thread belongs to a completed release
    for (const releaseNum of completedReleases) {
      if (thread.name === `R${releaseNum} 🪼` || thread.name.startsWith(`R${releaseNum} `)) {
        try {
          const oldName = thread.name;
          const newName = `📦 [ARCHIVED] ${oldName}`;
          
          await thread.send('🗄️ **Release complete!** This thread has been archived.');
          await thread.setName(newName);
          await thread.setArchived(true);
          await thread.setLocked(true);
          
          console.log(`Archived: ${oldName} → ${newName}`);
        } catch (error) {
          console.log(`Failed to archive ${thread.name}:`, error.message);
        }
        break;
      }
    }
  }
  
  console.log('Done! Exiting...');
  client.destroy();
  process.exit(0);
});

client.login(BOT_TOKEN);
