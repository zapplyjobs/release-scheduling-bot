const { Client, GatewayIntentBits } = require('discord.js');

const client = new Client({ 
  intents: [
    GatewayIntentBits.Guilds, 
    GatewayIntentBits.GuildMembers
  ] 
});

// === CONFIGURATION ===
const BOT_TOKEN = process.env.BOT_TOKEN;
const GIST_ID = process.env.GIST_ID;
const GIST_TOKEN = process.env.GIST_TOKEN;
const SOURCE_SERVER_ID = '1391055226722844713';
const DESTINATION_CHANNEL_ID = '1459572071494451210';

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

const ALL_ROLES = { ...STUDENT_ROLES, ...SOURCE_ROLES };

// === GIST FUNCTIONS ===
async function getStoredMembers() {
  try {
    const response = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
      headers: { 'Authorization': `token ${GIST_TOKEN}` }
    });
    const data = await response.json();
    const content = data.files['members.json'].content;
    return JSON.parse(content);
  } catch (error) {
    console.log('No stored members found, starting fresh');
    return {};
  }
}

async function saveMembers(members) {
  await fetch(`https://api.github.com/gists/${GIST_ID}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `token ${GIST_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      files: {
        'members.json': {
          content: JSON.stringify(members, null, 2)
        }
      }
    })
  });
}

client.once('ready', async () => {
  console.log(`Bot is online as ${client.user.tag}`);
  
  try {
    const guild = await client.guilds.fetch(SOURCE_SERVER_ID);
    await guild.members.fetch();
    
    const totalMembers = guild.memberCount;
    
    // Get stored members from yesterday
    const storedMembers = await getStoredMembers();
    
    // Build current members list
    const currentMembers = {};
    for (const [id, member] of guild.members.cache) {
      if (member.user.bot) continue;
      
      const roles = [];
      for (const [name, roleId] of Object.entries(ALL_ROLES)) {
        if (member.roles.cache.has(roleId)) {
          roles.push(name);
        }
      }
      
      currentMembers[id] = {
        username: member.user.username,
        roles: roles
      };
    }
    
    // Find members who left
    const leftMembers = [];
    for (const [id, data] of Object.entries(storedMembers)) {
      if (!currentMembers[id]) {
        leftMembers.push(data);
      }
    }
    
    // Get members who joined in the last 24 hours
    const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
    const newMembers = guild.members.cache.filter(m => m.joinedTimestamp > oneDayAgo && !m.user.bot);
    const newMemberCount = newMembers.size;
    
    // Count student roles for NEW members only
    const studentCounts = {};
    let noStudentRole = 0;
    const studentRoleIds = Object.values(STUDENT_ROLES);
    
    for (const [id, member] of newMembers) {
      const hasStudentRole = studentRoleIds.some(roleId => member.roles.cache.has(roleId));
      if (hasStudentRole) {
        for (const [name, roleId] of Object.entries(STUDENT_ROLES)) {
          if (member.roles.cache.has(roleId)) {
            studentCounts[name] = (studentCounts[name] || 0) + 1;
          }
        }
      } else {
        noStudentRole++;
      }
    }
    
    // Count source roles for NEW members only
    const sourceCounts = {};
    let noSourceRole = 0;
    const sourceRoleIds = Object.values(SOURCE_ROLES);
    
    for (const [id, member] of newMembers) {
      const hasSourceRole = sourceRoleIds.some(roleId => member.roles.cache.has(roleId));
      if (hasSourceRole) {
        for (const [name, roleId] of Object.entries(SOURCE_ROLES)) {
          if (member.roles.cache.has(roleId)) {
            sourceCounts[name] = (sourceCounts[name] || 0) + 1;
          }
        }
      } else {
        noSourceRole++;
      }
    }
    
    // Format student stats
    let studentStats = '';
    for (const [name, count] of Object.entries(studentCounts)) {
      studentStats += `• ${name}: ${count}\n`;
    }
    if (noStudentRole > 0) {
      studentStats += `• No role selected: ${noStudentRole}\n`;
    }
    
    // Format source stats
    let sourceStats = '';
    for (const [name, count] of Object.entries(sourceCounts)) {
      sourceStats += `• ${name}: ${count}\n`;
    }
    if (noSourceRole > 0) {
      sourceStats += `• No role selected: ${noSourceRole}\n`;
    }
    
    // Format left members
    let leftStats = '';
    if (leftMembers.length > 0) {
      for (const member of leftMembers) {
        const rolesText = member.roles.length > 0 ? member.roles.join(', ') : 'No roles';
        leftStats += `• ${member.username}\n  Roles: ${rolesText}\n`;
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
    let statsMessage = `📊 **Daily Server Stats - ${guild.name}**\n` +
      `📅 ${today}\n\n` +
      `👥 **Total Members:** ${totalMembers}\n` +
      `🆕 **New Today:** ${newMemberCount}\n` +
      `👋 **Left Today:** ${leftMembers.length}\n\n` +
      `🎓 **New Members - Student Status:**\n${studentStats || 'None today\n'}\n` +
      `🔍 **New Members - How They Found Us:**\n${sourceStats || 'None today\n'}`;
    
    if (leftMembers.length > 0) {
      statsMessage += `\n📤 **Members Who Left:**\n${leftStats}`;
    }
    
    // Send to destination channel
    const channel = await client.channels.fetch(DESTINATION_CHANNEL_ID);
    await channel.send(statsMessage);
    
    // Save current members for tomorrow
    await saveMembers(currentMembers);
    
    console.log('Stats posted successfully!');
    console.log(`Stored ${Object.keys(currentMembers).length} members for tomorrow`);
    
  } catch (error) {
    console.error('Error:', error.message);
  }
  
  client.destroy();
  process.exit(0);
});

client.login(BOT_TOKEN);