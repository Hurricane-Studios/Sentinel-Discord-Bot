const fs = require('fs').promises;
const path = require('path');
const { EmbedBuilder } = require('discord.js');

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
            warnedUsers: {},
            logChannelId: null,
        };
        await saveConfig(config); // Save the new guild configuration
    }
    return config.servers[guildId];
}

// Send log message as an embed to the configured log channel
async function sendLog(guild, title, description, color = '#FFA500') {
    const config = await ensureGuildConfig(guild.id);
    const logChannelId = config.logChannelId;

    if (!logChannelId) return; // No log channel set, do nothing

    const logChannel = await guild.channels.fetch(logChannelId).catch(() => null);
    if (!logChannel) return; // If log channel cannot be fetched, exit

    const embed = new EmbedBuilder()
        .setColor(color)
        .setTitle(title)
        .setDescription(description)
        .setTimestamp();

    await logChannel.send({ embeds: [embed] });
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
            const member = message.guild.members.cache.get(userId);

            // Update warnings count
            guildConfig.warnedUsers[userId] = (guildConfig.warnedUsers[userId] || 0) + 1;
            const warningCount = guildConfig.warnedUsers[userId];

            const config = await loadConfig();
            config.servers[message.guild.id] = guildConfig; // Update the guild's config
            await saveConfig(config); // Save the updated config

            // Notify the user about their warning
            await message.channel.send(
                `<@${userId}>, you've said a blacklisted word and have been automatically warned. You now have ${warningCount} warning(s).`
            );

            // Log the warning action
            await sendLog(
                message.guild,
                '⚠️ User Warned',
                `${message.author.tag} was warned for using a blacklisted word. Total warnings: **${warningCount}**.`,
                '#FFFF00'
            );

            // Check if user needs to be timed out or kicked
            if (warningCount % 3 === 0) {
                const timeoutDuration = 5 * 60 * 1000; // 5 minutes in milliseconds
                await member.timeout(timeoutDuration, 'Received 3 warnings.');

                // Log the timeout
                await sendLog(
                    message.guild,
                    '⏲️ User Timed Out',
                    `${message.author.tag} has been timed out for 5 minutes due to receiving 3 warnings.`,
                    '#FFA500'
                );
            }

            if (warningCount >= 10) {
                await member.kick('Received 10 warnings.');

                // Log the kick
                await sendLog(
                    message.guild,
                    '👢 User Kicked',
                    `${message.author.tag} has been kicked from the server for receiving 10 warnings.`,
                    '#FF0000'
                );
            }

            console.log(`Automod: Deleted a message from ${message.author.tag} in ${message.guild.name}`);
        } catch (error) {
            console.error('Error handling blacklisted word message:', error);
        }
    }
}

module.exports = { handleAutoModMessage };
