const { Client, GatewayIntentBits } = require('discord.js');

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

// === CONFIG ===
const BOT_TOKEN = process.env.BOT_TOKEN;

const CHANNEL_ID = '1502913220657156116';

const CSV_URL =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vQxtlreotDli-1UOfdpRKeMT0cK3t_8Bnxx2gvQwqINXaaThIIUXBSTTAqKQmK-CDr5k5KJie5XCINY/pub?output=csv';

const ALL_DEVS = [
  'Shaheer',
  'Rihab',
  'Anas',
  'Ramish',
  'Arsalan',
  'Ezaan',
  'Amaar',
  'Aliyan',
  'Moin',
  'Adeel',
  'Arfaat',
  'Sumair'
];

// === HELPERS ===
function normalizeName(name) {
  return name.trim().toLowerCase();
}

function getTodayDateString() {
  const now = new Date();

  // Pakistan Time
  const pktDate = new Date(
    now.toLocaleString('en-US', { timeZone: 'Asia/Karachi' })
  );

  const month = pktDate.toLocaleString('en-US', { month: 'short' });
  const day = pktDate.getDate();

  return `${month} ${day}`;
}

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

// === MAIN ===
async function fetchReportData() {
  const response = await fetch(CSV_URL);
  const csvText = await response.text();

  const lines = csvText.split('\n');

  const today = 'May 9';

  console.log('Checking date:', today);

  const counts = {};

  // initialize all devs to 0
  for (const dev of ALL_DEVS) {
    counts[normalizeName(dev)] = 0;
  }

  // skip header
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();

    if (!line) continue;

    const cols = parseCSVLine(line);

    const date = cols[0]?.trim();
    const tester = cols[1]?.trim();

    if (!date || !tester) continue;

    // Match today's date
    if (date.startsWith(today)) {
      const normalizedTester = normalizeName(tester);

      if (counts.hasOwnProperty(normalizedTester)) {
        counts[normalizedTester]++;
      }
    }
  }

  return counts;
}

function buildReport(counts) {
  const completed = [];
  const partial = [];
  const none = [];

  for (const dev of ALL_DEVS) {
    const normalized = normalizeName(dev);
    const count = counts[normalized] || 0;

    if (count >= 5) {
      completed.push(`• ${dev} — ${count}`);
    } else if (count > 0) {
      partial.push(`• ${dev} — ${count}`);
    } else {
      none.push(`• ${dev}`);
    }
  }

  const now = 'Friday, May 9';

  return (
    `📊 **Daily Extension Testing Report**\n` +
    `📅 ${now}\n\n` +

    `✅ **Applied to 5+ jobs**\n` +
    `${completed.length ? completed.join('\n') : 'None'}\n\n` +

    `⚠️ **Applied to less than 5 jobs**\n` +
    `${partial.length ? partial.join('\n') : 'None'}\n\n` +

    `❌ **No applications today**\n` +
    `${none.length ? none.join('\n') : 'None'}`
  );
}

client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);

  try {
    const counts = await fetchReportData();

    const report = buildReport(counts);

    const channel = await client.channels.fetch(CHANNEL_ID);

    await channel.send(report);

    console.log('Report sent successfully');
  } catch (error) {
    console.error('Error:', error);
  }

  client.destroy();
  process.exit(0);
});

client.login(BOT_TOKEN);
