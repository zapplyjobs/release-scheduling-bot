const { Client, GatewayIntentBits } = require('discord.js');
const client = new Client({ 
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] 
});

// === CONFIGURATION ===
const BOT_TOKEN = process.env.BOT_TOKEN;
const CHANNEL_ID = '1452477431096152196';
const START_DATE = new Date('2026-01-22'); // Thursday - must align with Thursday cron schedule
const SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTOQD3D48hwyKTTVCLvvv2ItQ7GB-hBR8346DR-WOhYllb8lkLymoimEY5xjc_I046P3za7i4LzQsNl/pub?gid=1810019676&single=true&output=csv';

// Check if this is a scheduled run (not manual)
const IS_SCHEDULED = process.env.GITHUB_EVENT_NAME === 'schedule';

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
      const competitor = columns[1]?.trim(); // Column B is Competitor
      const status = columns[2]?.trim();     // Column C is Status
      const owner = columns[3]?.trim();      // Column D is Owner
      const release = columns[4]?.trim();    // Column E is Release
      
      if (project && owner && release) {
        projects.push({ project, competitor, status, owner, release });
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
  const maxCompetitorLen = Math.max(...projects.map(p => (p.competitor || '-').length), 10);
  const maxStatusLen = 6; // Status emoji is short
  const maxOwnerLen = Math.max(...projects.map(p => p.owner.length), 5);
  
  // Cap lengths to prevent overflow
  const projectColWidth = Math.min(maxProjectLen, 35);
  const competitorColWidth = Math.min(maxCompetitorLen, 12);
  const statusColWidth = maxStatusLen;
  const ownerColWidth = Math.min(maxOwnerLen, 12);
  
  let table = '\n\n📋 **Projects this release:**\n```\n';
  table += 'Project'.padEnd(projectColWidth) + '  ' + 
           'Competitor'.padEnd(competitorColWidth) + '  ' +
           'Status'.padEnd(statusColWidth) + '  ' +
           'Owner'.padEnd(ownerColWidth) + '\n';
  table += '─'.repeat(projectColWidth + competitorColWidth + statusColWidth + ownerColWidth + 6) + '\n';
  
  for (const p of projects) {
    const projectName = p.project.length > projectColWidth 
      ? p.project.substring(0, projectColWidth - 3) + '...' 
      : p.project.padEnd(projectColWidth);
    const competitor = (p.competitor || '-').padEnd(competitorColWidth);
    const status = (p.status || '-').padEnd(statusColWidth);
    const ownerName = p.owner.padEnd(ownerColWidth);
    table += `${projectName}  ${competitor}  ${status}  ${ownerName}\n`;
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

async function findExistingThread(channel, release) {
  // Check active threads
  const activeThreads = await channel.threads.fetchActive();
  for (const [id, thread] of activeThreads.threads) {
    // Match "R3 🪼" but not "R3W1" or "[ARCHIVED] R3"
    if (thread.name === `R${release} 🪼` || thread.name.startsWith(`R${release} `)) {
      if (!thread.name.includes('[ARCHIVED]')) {
        return thread;
      }
    }
  }
  
  // Check archived threads (may fail if bot lacks Read Message History permission)
  try {
    const archivedThreads = await channel.threads.fetchArchived({ limit: 50 });
    for (const [id, thread] of archivedThreads.threads) {
      if (thread.name === `R${release} 🪼` || thread.name.startsWith(`R${release} `)) {
        if (!thread.name.includes('[ARCHIVED]')) {
          // Unarchive it so we can post
          await thread.setArchived(false);
          return thread;
        }
      }
    }
  } catch (error) {
    console.log('Could not check archived threads (missing permission), skipping check.');
  }
  
  return null;
}

client.once('ready', async () => {
  console.log(`Bot is online as ${client.user.tag}`);
  console.log(`Is scheduled run: ${IS_SCHEDULED}`);
  
  // Fetch projects from Google Sheets
  const allProjects = await fetchProjects();
  
  const channel = await client.channels.fetch(CHANNEL_ID);
  const today = new Date();
  const releases = getReleasesForDate(today);
  
  console.log('Today:', today.toDateString());
  console.log('Active releases:', releases);
  
  for (const { release, week } of releases) {
    const phase = weekDescriptions[week];
    const threadName = `R${release} 🪼`;
    
    // Get projects for this release
    const releaseProjects = getProjectsForRelease(allProjects, release);
    const projectsTable = formatProjectsTable(releaseProjects);
    
    // Build the message
    const message = 
      `🚀 **Release ${release} — Week ${week}: ${phase}**\n\n` +
      `📅 This thread covers R${release}W${week}.\n` +
      `Phase: **${phase}**` +
      projectsTable;
    
    // Check if thread already exists
    const existingThread = await findExistingThread(channel, release);
    
    // Add @tech ping only on scheduled runs
    const finalMessage = IS_SCHEDULED 
      ? message + `\n\n<@&1394533853598711868>`
      : message;
    
    if (existingThread) {
      // Thread exists - send weekly update
      await existingThread.send(finalMessage);
      console.log(`Posted Week ${week} update to existing thread: ${threadName}`);
    } else {
      // Create new thread (Week 1)
      const thread = await channel.threads.create({
        name: threadName,
        autoArchiveDuration: 10080, // 7 days auto-archive (Discord feature, we handle manually)
        reason: `Release ${release} thread`
      });
      
      await thread.send(finalMessage);
      await channel.send(`New thread created: ${thread}`);
      console.log(`Created thread: ${threadName}`);
    }
  }
  
  console.log('Done! Exiting...');
  client.destroy();
  process.exit(0);
});

client.login(BOT_TOKEN);
