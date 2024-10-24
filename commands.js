const fs = require('fs').promises;
const path = require('path');
const { REST, Routes, SlashCommandBuilder, EmbedBuilder } = require('discord.js'); // Add EmbedBuilder here
require('dotenv').config();

// Path to the JSON file storing all guild configurations
const configPath = path.join(__dirname, 'serverConfigs.json');

// Load the full configuration file from JSON
async function loadConfig() {
    try {
        const data = await fs.readFile(configPath, 'utf-8');
        console.log('Loaded config:', data); // Debugging log
        return JSON.parse(data);
    } catch (error) {
        console.error('Failed to load server configs:', error);
        return { servers: {} };
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

// Ensure that the guild has a default configuration
async function ensureGuildConfig(guildId) {
    const config = await loadConfig();

    // If the server config does not exist, create a default one
    if (!config.servers[guildId]) {
        config.servers[guildId] = {
            automodEnabled: true,
            blacklistedWords: [],
            warnedUsers: {},
            logChannelId: null  // Ensure log channel ID is stored per server
        };
        await saveConfig(config); // Save the newly created server configuration
    }

    return config.servers[guildId];
}


// Add a warning to a user in a specific guild
async function addWarning(guildId, userId) {
    const config = await loadConfig();
    const guildConfig = await ensureGuildConfig(guildId);

    guildConfig.warnedUsers[userId] = (guildConfig.warnedUsers[userId] || 0) + 1;
    config.servers[guildId] = guildConfig;
    await saveConfig(config);
}

// Clear warnings for a user in a specific guild
async function clearWarnings(guildId, userId, amount = 0) {
    const config = await loadConfig();
    const guildConfig = await ensureGuildConfig(guildId);

    if (amount <= 0) {
        delete guildConfig.warnedUsers[userId]; // Clear all warnings
    } else {
        guildConfig.warnedUsers[userId] = Math.max(0, (guildConfig.warnedUsers[userId] || 0) - amount);
    }

    config.servers[guildId] = guildConfig;
    await saveConfig(config);
}

// Add blacklisted words to a guild’s config
async function addBlacklistedWords(guildId, words) {
    const config = await loadConfig();
    const guildConfig = await ensureGuildConfig(guildId);

    // Add words to the blacklist, ensuring no duplicates
    guildConfig.blacklistedWords = [...new Set([...guildConfig.blacklistedWords, ...words])];
    config.servers[guildId] = guildConfig;

    await saveConfig(config);
}

async function clearMessagesCommand(interaction) {
    const amount = interaction.options.getInteger('amount');
    const reason = interaction.options.getString('reason') || 'No reason provided';

    if (amount < 1 || amount > 1000) {
        return await interaction.reply({
            content: 'You can only delete between 1 and 1000 messages.',
            ephemeral: true,
        });
    }

    const channel = interaction.channel;

    try {
        await interaction.deferReply({ ephemeral: true });

        let remaining = amount;
        while (remaining > 0) {
            const batchSize = Math.min(remaining, 100);
            const messages = await channel.messages.fetch({ limit: batchSize });
            if (messages.size === 0) break; // Stop if no messages are found

            const deleted = await channel.bulkDelete(messages, true);
            remaining -= deleted.size; // Reduce only by the actual deleted messages
        }

        const embed = new EmbedBuilder()
            .setColor('#FF0000')
            .setTitle('Messages Cleared')
            .addFields(
                { name: 'Amount', value: `${amount} messages`, inline: true },
                { name: 'Reason', value: reason, inline: true }
            )
            .setTimestamp();

        const reply = await interaction.editReply({ embeds: [embed] });

        setTimeout(() => {
            reply.delete().catch(console.error);
        }, 5000);

        // Log the action
        await sendLog(interaction, `${interaction.user.tag} used /clear to delete ${amount} messages for: ${reason}`);
    } catch (error) {
        console.error('Error clearing messages:', error);
        await interaction.editReply({ content: 'An error occurred while trying to clear messages.' });
    }
}

// Clear the blacklist for a guild
async function clearBlacklist(guildId) {
    const config = await loadConfig();
    const guildConfig = await ensureGuildConfig(guildId);

    guildConfig.blacklistedWords = [];
    config.servers[guildId] = guildConfig;

    await saveConfig(config);
}

// Toggle automod for a guild
async function toggleAutomod(guildId, isEnabled) {
    const config = await loadConfig();
    const guildConfig = await ensureGuildConfig(guildId);

    guildConfig.automodEnabled = isEnabled;
    config.servers[guildId] = guildConfig;

    await saveConfig(config);
}

async function setBotLogsCommand(interaction) {
    const channel = interaction.options.getChannel('channel');

    if (!channel.isTextBased()) {
        return await interaction.reply({
            content: 'Please select a text-based channel.',
            ephemeral: true,
        });
    }

    const guildId = interaction.guildId;
    const config = await ensureGuildConfig(guildId);

    // Save the log channel ID in the correct place
    config.logChannelId = channel.id;
    
    // Load the full config, update the specific server, and save it
    const fullConfig = await loadConfig();
    fullConfig.servers[guildId] = config;
    await saveConfig(fullConfig);

    const embed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle('Bot Logs Channel Set')
        .setDescription(`All bot actions will now be logged in <#${channel.id}>`)
        .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function sendLog(interaction, message) {
    const guildId = interaction.guildId;
    const config = await ensureGuildConfig(guildId);
    const logChannelId = config.logChannelId;

    if (!logChannelId) {
        console.warn(`No log channel set for guild ${guildId}.`);
        return; // Exit if no log channel is set
    }

    const logChannel = await interaction.guild.channels.fetch(logChannelId).catch(() => null);
    if (!logChannel) {
        console.warn(`Could not fetch log channel for guild ${guildId}.`);
        return; // Exit if the log channel cannot be fetched
    }

    const embed = new EmbedBuilder()
        .setColor('#FFA500')
        .setTitle('Bot Action Log')
        .setDescription(message)
        .setTimestamp();

    await logChannel.send({ embeds: [embed] });
}

// Command handlers
async function warnCommand(interaction) {
    const guildId = interaction.guildId;
    if (!guildId) {
        console.error('Guild ID is undefined in warn command.');
        return interaction.reply({
            content: 'Unable to identify the guild. Please try again later.',
            ephemeral: true,
        });
    }

    const user = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason') || 'No reason provided';

    try {
        await addWarning(guildId, user.id);
        const config = await ensureGuildConfig(guildId);
        const warnings = config.warnedUsers[user.id] || 0;

        const embed = new EmbedBuilder()
            .setColor('#FF0000')
            .setTitle(`${user.tag} has been warned`)
            .setThumbnail(user.displayAvatarURL())
            .addFields(
                { name: 'Reason', value: reason, inline: false },
                { name: 'Total Warnings', value: warnings.toString(), inline: true }
            )
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });

        // Log the action
        await sendLog(interaction, `${interaction.user.tag} used /warn on ${user.tag} for the reason: ${reason}`);
    } catch (error) {
        console.error('Error handling warn:', error);
        await interaction.reply({
            content: 'An error occurred while processing the warning.',
            ephemeral: true,
        });
    }
}



async function clearWarnCommand(interaction) {
    const guildId = interaction.guildId;
    const user = interaction.options.getUser('user');
    const amount = interaction.options.getInteger('amount') || 0;
    const reason = interaction.options.getString('reason'); // Required reason

    // Clear the specified amount of warnings for the user
    await clearWarnings(guildId, user.id, amount);

    // Fetch the updated warnings count after removal
    const config = await ensureGuildConfig(guildId);
    const currentWarnings = config.warnedUsers[user.id] || 0;

    // Create an embed message showing the cleared and current warnings
    const embed = new EmbedBuilder()
        .setColor('#00FF00') // Green color for success
        .setTitle(`Warnings Cleared for ${user.tag}`)
        .setThumbnail(user.displayAvatarURL()) // Display user's avatar
        .addFields(
            { name: 'User', value: `<@${user.id}>`, inline: true },
            { name: 'Warnings Removed', value: amount.toString(), inline: true },
            { name: 'Current Warnings', value: currentWarnings.toString(), inline: true }, // Current warnings
            { name: 'Reason', value: reason, inline: false }
        )
        .setTimestamp();

    // Send the embed message
    await interaction.reply({ embeds: [embed] });
}

async function currentWarnsCommand(interaction) {
    const guildId = interaction.guildId;
    const user = interaction.options.getUser('user');

    const config = await ensureGuildConfig(guildId);
    const warnings = config.warnedUsers[user.id] || 0;

    const embed = new EmbedBuilder()
        .setColor('#FFD700')
        .setTitle(`Warnings for ${user.tag}`)
        .setThumbnail(user.displayAvatarURL())
        .addFields(
            { name: 'Total Warnings', value: warnings.toString(), inline: true }
        )
        .setTimestamp();

    await interaction.reply({ embeds: [embed] });
}


// Command Handler: Add blacklisted words command
async function addBlacklistedWordsCommand(interaction) {
    try {
        const guildId = interaction.guildId;
        const words = interaction.options.getString('words').split(/\s+/);

        await addBlacklistedWords(guildId, words);
        await interaction.reply(`Added to blacklist: ${words.join(', ')}`);
    } catch (error) {
        console.error('Error handling addblacklistedwords:', error);
        await interaction.reply({
            content: 'An error occurred while adding words to the blacklist.',
            ephemeral: true
        });
    }
}

async function clearBlacklistCommand(interaction) {
    const guildId = interaction.guildId;

    await clearBlacklist(guildId);

    const embed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle('Blacklist Cleared')
        .setDescription('All blacklisted words have been removed.')
        .setTimestamp();

    await interaction.reply({ embeds: [embed] });
}


async function currentBlacklistCommand(interaction) {
    const guildId = interaction.guildId;
    const config = await ensureGuildConfig(guildId);
    const blacklist = config.blacklistedWords;

    const embed = new EmbedBuilder()
        .setColor('#FFA500')
        .setTitle('Current Blacklist')
        .addFields(
            { 
                name: 'Words', 
                value: blacklist.length > 0 ? blacklist.join(', ') : 'The blacklist is empty.', 
                inline: false 
            }
        )
        .setTimestamp();

    await interaction.reply({ embeds: [embed] });
}


async function automodToggleCommand(interaction) {
    const guildId = interaction.guildId;
    const toggle = interaction.options.getString('toggle').toLowerCase();
    const isEnabled = toggle === 'y';

    await toggleAutomod(guildId, isEnabled);

    const embed = new EmbedBuilder()
        .setColor(isEnabled ? '#00FF00' : '#FF0000')
        .setTitle(`Automod ${isEnabled ? 'Enabled' : 'Disabled'}`)
        .setDescription(`Automod has been ${isEnabled ? 'enabled' : 'disabled'} for this server.`)
        .setTimestamp();

    await interaction.reply({ embeds: [embed] });
}


// Define slash commands
const commands = [
    new SlashCommandBuilder()
    .setName('setbotlogs')
    .setDescription('Set the channel for bot logs.')
    .addChannelOption(option =>
        option.setName('channel')
            .setDescription('The channel to send bot logs to.')
            .setRequired(true)),

    new SlashCommandBuilder()
        .setName('warn')
        .setDescription('Warn a user')
        .addUserOption(option => 
            option.setName('user')
                .setDescription('The user to warn')
                .setRequired(true))
        .addStringOption(option => 
            option.setName('reason')
                .setDescription('The reason for the warning')
                .setRequired(true)),

    new SlashCommandBuilder()
    .setName('clearwarn')
    .setDescription('Clear warnings for a user')
    .addUserOption(option =>
        option.setName('user')
            .setDescription('The user to clear warnings for')
            .setRequired(true))
    .addIntegerOption(option =>
        option.setName('amount')
            .setDescription('The amount of warnings to remove.')
            .setRequired(true))
    .addStringOption(option =>
        option.setName('reason')
            .setDescription('The reason for clearing the warnings.')
            .setRequired(true)), // Required reason
    
    new SlashCommandBuilder()
        .setName('clear')
        .setDescription('Clear a specific number of messages.')
        .addIntegerOption(option =>
            option.setName('amount')
                .setDescription('The number of messages to delete.')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('The reason for deleting the messages.')
                .setRequired(true)),

    new SlashCommandBuilder()
        .setName('currentwarns')
        .setDescription('Show the warning count for a user')
        .addUserOption(option => 
            option.setName('user')
                .setDescription('The user to check warnings for')
                .setRequired(true)),

    new SlashCommandBuilder()
        .setName('addblacklistedwords')
        .setDescription('Add words to the blacklist')
        .addStringOption(option => 
            option.setName('words')
                .setDescription('The words to blacklist')
                .setRequired(true)),

    new SlashCommandBuilder()
        .setName('clearblacklist')
        .setDescription('Clear all blacklisted words'),

    new SlashCommandBuilder()
        .setName('currentblacklist')
        .setDescription('Show the current blacklist'),

    new SlashCommandBuilder()
        .setName('automod')
        .setDescription('Toggle automod on or off')
        .addStringOption(option => 
            option.setName('toggle')
                .setDescription('Enable (y) or disable (n)')
                .setRequired(true))

].map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

async function registerCommandsForGuilds(client, guildId = null) {
    try {
        console.log('Refreshing commands.');

        if (guildId) {
            // Register commands for a single guild
            await rest.put(
                Routes.applicationGuildCommands(process.env.CLIENT_ID, guildId),
                { body: commands }
            );
            console.log(`Registered commands for guild: ${guildId}`);
        } else {
            // Register commands for all connected guilds
            const guilds = await client.guilds.fetch();

            for (const guild of guilds.values()) {
                await rest.put(
                    Routes.applicationGuildCommands(process.env.CLIENT_ID, guild.id),
                    { body: commands }
                );
                console.log(`Registered commands for guild: ${guild.name} (${guild.id})`);
            }
        }
    } catch (error) {
        console.error('Error registering commands:', error);
    }
}

module.exports = {
    warnCommand,
    clearWarnCommand,
    addBlacklistedWordsCommand,
    clearBlacklistCommand,
    currentBlacklistCommand,
    automodToggleCommand,
    currentWarnsCommand,
    clearMessagesCommand,
    setBotLogsCommand, // Add this line
    registerCommandsForGuilds,
};
