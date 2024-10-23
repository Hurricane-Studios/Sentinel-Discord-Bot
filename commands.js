const fs = require('fs');
const path = require('path');

const warningsPath = path.join(__dirname, 'warnings.json');

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

// Handle commands
function handleCommands(message) {
    const { content, channel } = message;
    const warnings = loadWarnings();

    if (content.startsWith('!warn')) {
        const targetUser = message.mentions.users.first();
        if (!targetUser) return channel.send('Please mention a user to warn.');

        const userId = targetUser.id;
        warnings[userId] = (warnings[userId] || 0) + 1;
        saveWarnings(warnings);

        channel.send(`<@${userId}> has been warned. They now have ${warnings[userId]} warnings.`);
    } else if (content.startsWith('!clearwarn')) {
        const targetUser = message.mentions.users.first();
        if (!targetUser) return channel.send('Please mention a user to clear warnings.');

        const userId = targetUser.id;
        warnings[userId] = 0;
        saveWarnings(warnings);

        channel.send(`Warnings for <@${userId}> have been cleared.`);
    }
}

module.exports = { handleCommands };
