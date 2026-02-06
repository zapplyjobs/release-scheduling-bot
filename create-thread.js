const { Client, GatewayIntentBits } = require('discord.js');
const client = new Client({ 
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] 
});

// === CONFIGURATION ===
const BOT_TOKEN = process.env.BOT_TOKEN;
const CHANNEL_ID = '1452477431096152196';
const TECH_CHANNEL_ID = '1371178076893085846';
const START_DATE = new Date('2026-01-22'); // Thursday - must align with Thursday cron schedule
const SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTOQD3D48hwyKTTVCLvvv2ItQ7GB-hBR8346DR-WOhYllb8lkLymoimEY5xjc_I046P3za7i4LzQsNl/pub?gid=1810019676&single=true&output=csv';

// Week descriptions
const weekDescriptions = {
  1: 'Dev',
  2: 'Dev + QA',
  3: 'QA',
  4: 'Launch 🚀'
};

// === FETCH PROJECTS FROM GOOGLE SHEETS ===
async function fetchProjects() {
  try {
    const response = await fetch(SHEET_CSV_URL);
    const csvText = await response.text();
    
    // Parse CSV
    const lines = csvText.split('\n');
    const projects = [];
    
    // Skip header row, parse each line
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      // Simple CSV parsing (handles basic cases)
      const columns = parseCSVLine(line);
      
      const project = columns[0]?.trim();
      const owner = columns[3]?.trim();   // Column D is Owner
      const release = columns[4]?.trim(); // Column E is Release
      
      if (project && owner && release) {
        projects.push({ project, owner, release });
      }
    }
    
    console.log(`Fetched ${projects.length} projects from Google Sheets`);
    return projects;
  } catch (error) {
    console.error('Failed to fetch projects from Google Sheets:', error.message);
    return [];
  }
}

// Simple CSV line parser that handles commas within fields
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  
  return result;
}

// Get projects for a specific release number
function getProjectsForRelease(projects, releaseNum) {
  return projects.filter(p => {
    const releaseField = p.release;
    
    // Handle formats like "R1", "R1 + R2", "R3 + R4", "R11 + R12"
    const matches = releaseField.match(/R(\d+)/g);
    if (!matches) return false;
    
    return matches.some(match => {
      const num = parseInt(match.replace('R', ''));
      return num === releaseNum;
    });
  });
}

// Format projects as a Discord code block table
function formatProjectsTable(projects) {
  if (projects.length === 0) {
    return '\n\n*No projects assigned to this release.*';
  }
  
  // Find max lengths for alignment
  const maxProjectLen = Math.max(...projects.map(p => p.project.length), 7);
  const maxOwnerLen = Math.max(...projects.map(p => p.owner.length), 5);
  
  // Cap lengths to prevent overflow
  const projectColWidth = Math.min(maxProjectLen, 50);
  const ownerColWidth = Math.min(maxOwnerLen, 15);
  
  let table = '\n\n📋 **Projects this release:**\n```\n';
  table += 'Project'.padEnd(projectColWidth) + '  ' + 'Owner'.padEnd(ownerColWidth) + '\n';
  table += '─'.repeat(projectColWidth + ownerColWidth + 2) + '\n';
  
  for (const p of projects) {
    const projectName = p.project.length > projectColWidth 
      ? p.project.substring(0, projectColWidth - 3) + '...' 
      : p.project.padEnd(projectColWidth);
    const ownerName = p.owner.padEnd(ownerColWidth);
    table += `${projectName}  ${ownerName}\n`;
  }
  
  table += '```';
  return table;
}

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

async function threadExists(channel, threadName) {
  // Check active threads
  const activeThreads = await channel.threads.fetchActive();
  for (const [id, thread] of activeThreads.threads) {
    if (thread.name.includes(`R${threadName.release}W${threadName.week}`)) {
      return true;
    }
  }
  
  // Check archived threads (may fail if bot lacks Read Message History permission)
  try {
    const archivedThreads = await channel.threads.fetchArchived({ limit: 50 });
    for (const [id, thread] of archivedThreads.threads) {
      if (thread.name.includes(`R${threadName.release}W${threadName.week}`)) {
        return true;
      }
    }
  } catch (error) {
    console.log('Could not check archived threads (missing permission), skipping check.');
  }
  
  return false;
}

client.once('ready', async () => {
  console.log(`Bot is online as ${client.user.tag}`);
  
  // Fetch projects from Google Sheets
  const allProjects = await fetchProjects();
  
  const channel = await client.channels.fetch(CHANNEL_ID);
  const techChannel = await client.channels.fetch(TECH_CHANNEL_ID);
  const today = new Date();
  const releases = getReleasesForDate(today);
  
  console.log('Today:', today.toDateString());
  console.log('Active releases:', releases);
  
  for (const { release, week } of releases) {
    const phase = weekDescriptions[week];
    const threadName = `R${release}W${week} 🪼`;
    
    // Check if this thread already exists (avoid duplicates)
    const alreadyExists = await threadExists(channel, { release, week });
    if (alreadyExists) {
      console.log(`Thread ${threadName} already exists, skipping.`);
      continue;
    }
    
    // Get projects for this release
    const releaseProjects = getProjectsForRelease(allProjects, release);
    const projectsTable = formatProjectsTable(releaseProjects);
    
    // Create a new thread for every release+week combination
    const thread = await channel.threads.create({
      name: threadName,
      autoArchiveDuration: 10080, // 7 days
      reason: `Release ${release} - Week ${week} thread`
    });
    
    await thread.send(
      `🚀 **Release ${release} — Week ${week}: ${phase}**\n\n` +
      `📅 This thread covers R${release}W${week}.\n` +
      `Phase: **${phase}**` +
      projectsTable
    );
    
    await techChannel.send(`New thread created: ${thread}`);
    await channel.send(`New thread created: ${thread}`);
    console.log(`Created thread: ${threadName}`);
  }
  
  console.log('Done! Exiting...');
  client.destroy();
  process.exit(0);
});

client.login(BOT_TOKEN);
