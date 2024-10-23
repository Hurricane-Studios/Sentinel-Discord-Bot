const fs = require('fs');
const path = require('path');

// Load warnings and config
const warningsPath = path.join(__dirname, 'warnings.json');
const configPath = path.join(__dirname, 'config.json');

// Load warnings from JSON
function loadWarnings() {
    if (!fs.existsSync(warningsPath)) return {};
    const data = fs.readFileSync(warningsPath, 'utf-8');
    return JSON.parse(data);
}

// Save warnings to JSON
function saveWarnings(warnings) {
    fs.writeFileSync(warningsPath, JSON.stringify(warnings, null, 2));
}

// Load config from JSON
function loadConfig() {
    if (!fs.existsSync(configPath)) return { blacklistedWords: [] };
    const data = fs.readFileSync(configPath, 'utf-8');
    return JSON.parse(data);
}

// Automod function to monitor messages
async function handleAutoModMessage(message) {
    if (message.author.bot) return; // Ignore bot messages

    const config = loadConfig();
    const blacklistedWords = config.blacklistedWords || [];
    const messageContent = message.content.toLowerCase(); // Case-insensitive matching

    // Check if the message contains any blacklisted word
    const containsBlacklistedWord = blacklistedWords.some(word =>
        messageContent.includes(word.toLowerCase())
    );

    if (containsBlacklistedWord) {
        // Delete the message
        await message.delete();

        // Warn the user
        const warnings = loadWarnings();
        const userId = message.author.id;

        warnings[userId] = (warnings[userId] || 0) + 1;
        saveWarnings(warnings);

        // Send a warning message to the user
        await message.channel.send(
            `<@${userId}>, You've said a blacklisted word and have been automatically warned. You now have ${warnings[userId]} warning(s).`
        );
    }
}

module.exports = { handleAutoModMessage };
