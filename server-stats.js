const { Client, GatewayIntentBits } = require('discord.js');

const client = new Client({ 
  intents: [
    GatewayIntentBits.Guilds, 
    GatewayIntentBits.GuildMembers
  ] 
});

// === CONFIGURATION ===
const BOT_TOKEN = process.env.BOT_TOKEN;
const SOURCE_SERVER_ID = '1391055226722844713'; // Zapply.jobs
const DESTINATION_CHANNEL_ID = '1459572071494451210'; // Where to post stats

// Roles to track
const STUDENT_ROLES = {
  'Freshman': '1391626832138211478',
  'Sophomore': '1391626905609830471',
  'Junior': '1391626960152821770',
  'Senior': '1391626998543155321',
  'Master\'s Student': '1391627034848919663',
  'PhD Student': '1391627218299654284',
  'Fresh Grad': '1391627348645904415',
  'Alumni': '1391064125236580432'
};

const SOURCE_ROLES = {
  'LinkedIn': '1396772649731883008',
  'GitHub': '1396773236695629844',
  'Zapply Website': '1396772727867834451',
  'Google': '1396772808951861409',
  'Elsewhere': '1396772886219456572'
};

client.once('ready', async () => {
  console.log(`Bot is online as ${client.user.tag}`);
  
  try {
    // Fetch the source server
    const guild = await client.guilds.fetch(SOURCE_SERVER_ID);
    
    // Fetch all members to get accurate count
    await guild.members.fetch();
    
    const totalMembers = guild.memberCount;
    
    // Count members who joined in the last 24 hours
    const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
    const newMembers = guild.members.cache.filter(m => m.joinedTimestamp > oneDayAgo).size;
    
    // Count student roles
    let studentStats = '';
    for (const [name, roleId] of Object.entries(STUDENT_ROLES)) {
      const role = guild.roles.cache.get(roleId);
      if (role) {
        studentStats += `• ${name}: ${role.members.size}\n`;
      }
    }
    
    // Count source roles
    let sourceStats = '';
    for (const [name, roleId] of Object.entries(SOURCE_ROLES)) {
      const role = guild.roles.cache.get(roleId);
      if (role) {
        sourceStats += `• ${name}: ${role.members.size}\n`;
      }
    }
    
    // Get today's date
    const today = new Date().toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    
    // Create stats message
    const statsMessage = `📊 **Daily Server Stats - ${guild.name}**\n` +
      `📅 ${today}\n\n` +
      `👥 **Total Members:** ${totalMembers}\n` +
      `🆕 **New Today:** ${newMembers}\n\n` +
      `🎓 **Student Status:**\n${studentStats}\n` +
      `🔍 **How They Found Us:**\n${sourceStats}`;
    
    // Send to destination channel
    const channel = await client.channels.fetch(DESTINATION_CHANNEL_ID);
    await channel.send(statsMessage);
    
    console.log('Stats posted successfully!');
    
  } catch (error) {
    console.error('Error:', error.message);
  }
  
  client.destroy();
  process.exit(0);
});

client.login(BOT_TOKEN);