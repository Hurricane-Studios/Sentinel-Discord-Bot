const fs = require('fs').promises;
const path = require('path');

// Path to the JSON file storing all guild configurations
const configPath = path.join(__dirname, 'serverConfigs.json');

// Load the full configuration file from JSON
async function loadConfig() {
    try {
        const data = await fs.readFile(configPath, 'utf-8');
        const config = JSON.parse(data);
        if (!config.servers) config.servers = {}; // Ensure servers object exists
        return config;
    } catch (error) {
        console.error('Failed to load server configs:', error);
        return { servers: {} }; // Default to an empty structure
    }
}

// Save the updated configuration back to JSON
async function saveConfig(config) {
    try {
        await fs.writeFile(configPath, JSON.stringify(config, null, 2));
    } catch (error) {
        console.error('Failed to save server configs:', error);
    }
}

// Ensure a guild has a default configuration
async function ensureGuildConfig(guildId) {
    const config = await loadConfig();
    if (!config.servers[guildId]) {
        config.servers[guildId] = {
            automodEnabled: true,
            blacklistedWords: [],
            warnedUsers: {}
        };
        await saveConfig(config); // Save the new guild configuration
    }
    return config.servers[guildId];
}

// Automod function to monitor messages
async function handleAutoModMessage(message) {
    if (message.author.bot) return; // Ignore bot messages

    const guildConfig = await ensureGuildConfig(message.guild.id); // Get or create the guild config

    if (!guildConfig.automodEnabled) {
        console.log(`Automod is disabled on server: ${message.guild.name}`);
        return; // Exit if automod is disabled
    }

    const blacklistedWords = guildConfig.blacklistedWords;
    const messageContent = message.content.toLowerCase(); // Case-insensitive matching

    const containsBlacklistedWord = blacklistedWords.some(word =>
        messageContent.includes(word.toLowerCase())
    );

    if (containsBlacklistedWord) {
        try {
            await message.delete(); // Delete the offending message

            const userId = message.author.id;
            guildConfig.warnedUsers[userId] = (guildConfig.warnedUsers[userId] || 0) + 1;

            const config = await loadConfig();
            config.servers[message.guild.id] = guildConfig; // Update the guild's config
            await saveConfig(config); // Save the updated config

            await message.channel.send(
                `<@${userId}>, You've said a blacklisted word and have been automatically warned. You now have ${guildConfig.warnedUsers[userId]} warning(s).`
            );

            console.log(`Automod: Deleted a message from ${message.author.tag} in ${message.guild.name}`);
        } catch (error) {
            console.error('Error handling blacklisted word message:', error);
        }
    }
}

module.exports = { handleAutoModMessage };
