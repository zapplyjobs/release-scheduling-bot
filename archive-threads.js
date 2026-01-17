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
    console.log(`Checking thread: ${thread.name}, created: ${new Date(thread.createdTimestamp).toDateString()}`);
    
    // Skip if already archived or not a release thread
    if (thread.archived) {
      console.log(`Skipped ${thread.name} - already archived`);
      continue;
    }
    
    // Skip if already marked as archived
    if (thread.name.includes('📦') || thread.name.includes('[ARCHIVED]')) {
      console.log(`Skipped ${thread.name} - already marked archived`);
      continue;
    }
    
    // Check if thread is older than 7 days
    if (thread.createdTimestamp < sevenDaysAgo) {
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
      const ageInDays = Math.floor((Date.now() - thread.createdTimestamp) / (24 * 60 * 60 * 1000));
      console.log(`Skipped ${thread.name} - only ${ageInDays} days old (needs 7+)`);
    }
  }
  
  console.log('Done! Exiting...');
  client.destroy();
  process.exit(0);
});

client.login(BOT_TOKEN);