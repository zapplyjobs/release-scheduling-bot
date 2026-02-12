const { Client, GatewayIntentBits } = require('discord.js');
const client = new Client({ 
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] 
});

// === CONFIGURATION ===
const BOT_TOKEN = process.env.BOT_TOKEN;
const CHANNEL_ID = '1452477431096152196';

// Get the most recent Thursday (today if it's Thursday, otherwise last Thursday)
function getThisThursday() {
  const now = new Date();
  const dayOfWeek = now.getUTCDay(); // 0 = Sunday, 4 = Thursday
  const daysFromThursday = (dayOfWeek + 7 - 4) % 7; // Days since last Thursday
  
  const thisThursday = new Date(now);
  thisThursday.setUTCDate(now.getUTCDate() - daysFromThursday);
  thisThursday.setUTCHours(0, 0, 0, 0); // Start of that Thursday
  
  return thisThursday;
}

client.once('ready', async () => {
  console.log(`Bot is online as ${client.user.tag}`);
  
  const channel = await client.channels.fetch(CHANNEL_ID);
  const thisThursday = getThisThursday();
  
  console.log(`Archiving threads created before: ${thisThursday.toDateString()}`);
  
  // Fetch active threads
  const activeThreads = await channel.threads.fetchActive();
  console.log(`Found ${activeThreads.threads.size} active threads`);
  
  for (const [id, thread] of activeThreads.threads) {
    console.log(`Checking thread: ${thread.name}, created: ${new Date(thread.createdTimestamp).toDateString()}`);
    
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
    
    // Archive if thread was created before this Thursday
    if (thread.createdTimestamp < thisThursday.getTime()) {
      try {
        const oldName = thread.name;
        const newName = `📦 [ARCHIVED] ${oldName}`;
        
        await thread.send('🗄️ This thread has been archived.');
        await thread.setName(newName);
        await thread.setArchived(true);
        await thread.setLocked(true);
        
        console.log(`Archived: ${oldName} → ${newName}`);
      } catch (error) {
        console.log(`Failed to archive ${thread.name}:`, error.message);
      }
    } else {
      console.log(`Skipped ${thread.name} - created on/after this Thursday`);
    }
  }
  
  console.log('Done! Exiting...');
  client.destroy();
  process.exit(0);
});

client.login(BOT_TOKEN);
