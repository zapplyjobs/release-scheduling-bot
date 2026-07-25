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

const STUDENT_ROLES = {
  Freshman: '1391626832138211478',
  Sophomore: '1391626905609830471',
  Junior: '1391626960152821770',
  Senior: '1391626998543155321',
  "Master's Student": '1391627034848919663',
  'PhD Student': '1391627218299654284',
  'Fresh Grad': '1391627348645904415',
  Alumni: '1391064125236580432'
};

const SOURCE_ROLES = {
  LinkedIn: '1396772649731883008',
  GitHub: '1396773236695629844',
  'Zapply Website': '1396772727867834451',
  Google: '1396772808951861409',
  Elsewhere: '1396772886219456572'
};

const ALL_ROLES = {
  ...STUDENT_ROLES,
  ...SOURCE_ROLES
};

// === VALIDATE ENVIRONMENT VARIABLES ===
function validateConfiguration() {
  const missing = [];

  if (!BOT_TOKEN) missing.push('BOT_TOKEN');
  if (!GIST_ID) missing.push('GIST_ID');
  if (!GIST_TOKEN) missing.push('GIST_TOKEN');

  if (missing.length > 0) {
    throw new Error(
      `Missing environment variables: ${missing.join(', ')}`
    );
  }
}

// === GIST FUNCTIONS ===
async function getStoredMembers() {
  const response = await fetch(
    `https://api.github.com/gists/${GIST_ID}`,
    {
      headers: {
        Authorization: `Bearer ${GIST_TOKEN}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'discord-server-stats'
      }
    }
  );

  if (!response.ok) {
    const errorText = await response.text();

    throw new Error(
      `Failed to read Gist: ${response.status} ${errorText}`
    );
  }

  const data = await response.json();
  const file = data.files?.['members.json'];

  if (!file) {
    throw new Error(
      'The Gist does not contain a file named members.json'
    );
  }

  const storedMembers = JSON.parse(file.content);

  if (
    !storedMembers ||
    typeof storedMembers !== 'object' ||
    Array.isArray(storedMembers)
  ) {
    throw new Error('members.json does not contain a valid member object');
  }

  console.log(
    `Loaded ${Object.keys(storedMembers).length} members from the previous snapshot`
  );

  return storedMembers;
}

async function saveMembers(members) {
  const response = await fetch(
    `https://api.github.com/gists/${GIST_ID}`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${GIST_TOKEN}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'User-Agent': 'discord-server-stats'
      },
      body: JSON.stringify({
        files: {
          'members.json': {
            content: JSON.stringify(members, null, 2)
          }
        }
      })
    }
  );

  if (!response.ok) {
    const errorText = await response.text();

    throw new Error(
      `Failed to save Gist: ${response.status} ${errorText}`
    );
  }

  console.log(
    `Saved ${Object.keys(members).length} members for the next run`
  );
}

// === FORMATTING ===
function formatCounts(counts, noRoleCount) {
  let output = '';

  for (const [name, count] of Object.entries(counts)) {
    output += `• ${name}: ${count}\n`;
  }

  if (noRoleCount > 0) {
    output += `• No role selected: ${noRoleCount}\n`;
  }

  return output || 'None today\n';
}

client.once('ready', async () => {
  console.log(`Bot is online as ${client.user.tag}`);

  try {
    validateConfiguration();

    // Fetch the public/source server.
    const guild = await client.guilds.fetch(SOURCE_SERVER_ID);

    // Fetch the complete member list.
    await guild.members.fetch();

    // Only count human members.
    const humanMembers = guild.members.cache.filter(
      member => !member.user.bot
    );

    const totalMembers = humanMembers.size;

    // Load the member snapshot from the previous run.
    const storedMembers = await getStoredMembers();

    // Build the current member snapshot.
    const currentMembers = {};

    for (const [memberId, member] of humanMembers) {
      const roles = [];

      for (const [roleName, roleId] of Object.entries(ALL_ROLES)) {
        if (member.roles.cache.has(roleId)) {
          roles.push(roleName);
        }
      }

      currentMembers[memberId] = {
        username: member.user.username,
        roles
      };
    }

    /*
     * LEFT COUNT
     *
     * Every ID saved during the previous run is checked against
     * the current server member list.
     *
     * If the ID is no longer present, that member left.
     */
    let leftMemberCount = 0;

    for (const memberId of Object.keys(storedMembers)) {
      if (!currentMembers[memberId]) {
        leftMemberCount++;
      }
    }

    console.log(`Previous members: ${Object.keys(storedMembers).length}`);
    console.log(`Current members: ${Object.keys(currentMembers).length}`);
    console.log(`Members who left: ${leftMemberCount}`);

    // Find members who joined during the last 24 hours.
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;

    const newMembers = humanMembers.filter(
      member =>
        member.joinedTimestamp &&
        member.joinedTimestamp > oneDayAgo
    );

    const newMemberCount = newMembers.size;

    // Count student roles for new members.
    const studentCounts = {};
    let noStudentRole = 0;

    for (const member of newMembers.values()) {
      let hasStudentRole = false;

      for (const [roleName, roleId] of Object.entries(STUDENT_ROLES)) {
        if (member.roles.cache.has(roleId)) {
          studentCounts[roleName] =
            (studentCounts[roleName] || 0) + 1;

          hasStudentRole = true;
        }
      }

      if (!hasStudentRole) {
        noStudentRole++;
      }
    }

    // Count discovery-source roles for new members.
    const sourceCounts = {};
    let noSourceRole = 0;

    for (const member of newMembers.values()) {
      let hasSourceRole = false;

      for (const [roleName, roleId] of Object.entries(SOURCE_ROLES)) {
        if (member.roles.cache.has(roleId)) {
          sourceCounts[roleName] =
            (sourceCounts[roleName] || 0) + 1;

          hasSourceRole = true;
        }
      }

      if (!hasSourceRole) {
        noSourceRole++;
      }
    }

    const studentStats = formatCounts(
      studentCounts,
      noStudentRole
    );

    const sourceStats = formatCounts(
      sourceCounts,
      noSourceRole
    );

    const today = new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const statsMessage =
      `📊 **Daily Server Stats - ${guild.name}**\n` +
      `📅 ${today}\n\n` +
      `👥 **Total Members:** ${totalMembers}\n` +
      `🆕 **New Today:** ${newMemberCount}\n` +
      `👋 **Left Today:** ${leftMemberCount}\n\n` +
      `🎓 **New Members - Student Status:**\n` +
      `${studentStats}\n` +
      `🔍 **New Members - How They Found Us:**\n` +
      `${sourceStats}`;

    const channel = await client.channels.fetch(
      DESTINATION_CHANNEL_ID
    );

    if (!channel?.isTextBased() || !channel.isSendable()) {
      throw new Error(
        'The destination channel is unavailable or the bot cannot send messages there'
      );
    }

    // Post the statistics.
    await channel.send({
      content: statsMessage,
      allowedMentions: {
        parse: []
      }
    });

    // Save only after the message was successfully posted.
    await saveMembers(currentMembers);

    console.log('Stats posted successfully');
  } catch (error) {
    console.error('Stats job failed:', error);
    process.exitCode = 1;
  } finally {
    client.destroy();
  }
});

client.login(BOT_TOKEN);
