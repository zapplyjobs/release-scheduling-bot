const { Client, GatewayIntentBits } = require('discord.js');

const client = new Client({ 
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] 
});

// === CONFIGURATION ===
const BOT_TOKEN = process.env.BOT_TOKEN;
const CHANNEL_ID = '1452477431096152196';

client.once('ready', async () => {
  console.log(`Bot is online as ${client.user.tag}`);
  
  const channel = await client.channels.fetch(CHANNEL_ID);
  const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
  
  // Fetch active threads
  const activeThreads = await channel.threads.fetchActive();
  console.log(`Found ${activeThreads.threads.size} active threads`);
  
  for (const [id, thread] of activeThreads.threads) {
    // Skip if already archived or not a release thread
    if (thread.archived || !thread.name.includes('R')) continue;
    
    // Skip if already marked as archived
    if (thread.name.includes('📦')) continue;
    
    // Check if thread is older than 7 days
    if (thread.createdTimestamp < sevenDaysAgo) {
      try {
        const oldName = thread.name;
        const newName = `📦 [ARCHIVED] ${oldName}`;
        
        await thread.setName(newName);
        await thread.setArchived(true);
        await thread.setLocked(true);
        
        console.log(`Archived: ${oldName} → ${newName}`);
      } catch (error) {
        console.log(`Failed to archive ${thread.name}:`, error.message);
      }
    } else {
      console.log(`Skipped ${thread.name} - not old enough`);
    }
  }
  
  console.log('Done! Exiting...');
  client.destroy();
  process.exit(0);
});

client.login(BOT_TOKEN);