const fs = require('fs');
const path = require('path');

const warningsPath = path.join(__dirname, 'warnings.json');

// Load warnings from the JSON file
function loadWarnings() {
    if (!fs.existsSync(warningsPath)) return {};
    const data = fs.readFileSync(warningsPath, 'utf-8');
    return JSON.parse(data);
}

// Save warnings to the JSON file
function saveWarnings(warnings) {
    fs.writeFileSync(warningsPath, JSON.stringify(warnings, null, 2));
}

// Function to apply a timeout to a user
async function timeoutUser(guild, userId, duration) {
    try {
        const member = await guild.members.fetch(userId);
        await member.timeout(duration, `Received ${duration / (60 * 60 * 1000)} hour(s) timeout for warnings`);
        console.log(`Timed out ${member.user.tag} for ${duration}ms`);
    } catch (err) {
        console.error(`Failed to timeout user: ${err}`);
    }
}

// Handle punishments based on the user's warning count
async function handlePunishment(message) {
    const warnings = loadWarnings();
    const userId = message.author.id;
    const warnCount = warnings[userId] || 0;

    if (warnCount >= 11) {
        message.guild.members.kick(userId, 'You\'ve received too many warnings.')
            .then(() => {
                message.channel.send(`<@${userId}> has been kicked for receiving too many warnings.`);
            })
            .catch(err => {
                console.error(`Failed to kick user: ${err}`);
            });
    } else if (warnCount >= 3) {
        const hoursToTimeout = 2 + (warnCount - 3); // 2 hours + 1 hour per extra warning after 3
        const timeoutDuration = hoursToTimeout * 60 * 60 * 1000; // Convert to milliseconds

        message.channel.send(`<@${userId}> has been timed out for ${hoursToTimeout} hour(s).`);
        await timeoutUser(message.guild, userId, timeoutDuration);
    }
}

module.exports = { handlePunishment };
