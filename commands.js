const fs = require('fs').promises;
const path = require('path');
const { REST, Routes, SlashCommandBuilder } = require('discord.js');
require('dotenv').config();

// Path to the JSON file storing all guild configurations
const configPath = path.join(__dirname, 'serverConfigs.json');

// Load the full configuration file from JSON
async function loadConfig() {
    try {
        const data = await fs.readFile(configPath, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Failed to load server configs:', error);
        return { servers: {} }; // Default to an empty servers object
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

    // Ensure that the guild's configuration exists
    if (!config.servers[guildId]) {
        config.servers[guildId] = {
            automodEnabled: true,
            blacklistedWords: [],
            warnedUsers: {}
        };
        await saveConfig(config); // Save the new configuration
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

// Command handlers
async function warnCommand(interaction) {
    const guildId = interaction.guildId;
    const userId = interaction.options.getUser('user').id;

    await addWarning(guildId, userId);
    const config = await ensureGuildConfig(guildId);
    const warnings = config.warnedUsers[userId] || 0;

    await interaction.reply(`<@${userId}> now has ${warnings} warning(s).`);
}

async function clearWarnCommand(interaction) {
    const guildId = interaction.guildId;
    const userId = interaction.options.getUser('user').id;
    const amount = interaction.options.getInteger('amount') || 0;

    await clearWarnings(guildId, userId, amount);
    await interaction.reply(`Warnings for <@${userId}> have been cleared.`);
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
    await interaction.reply('Blacklist has been cleared.');
}

async function currentBlacklistCommand(interaction) {
    const guildId = interaction.guildId;
    const config = await ensureGuildConfig(guildId);
    const blacklist = config.blacklistedWords;

    if (blacklist.length === 0) {
        await interaction.reply('The blacklist is empty.');
    } else {
        await interaction.reply(`Current blacklist: ${blacklist.join(', ')}`);
    }
}

async function automodToggleCommand(interaction) {
    const guildId = interaction.guildId;
    const toggle = interaction.options.getString('toggle').toLowerCase();
    const isEnabled = toggle === 'y';

    await toggleAutomod(guildId, isEnabled);
    await interaction.reply(`Automod has been ${isEnabled ? 'enabled' : 'disabled'}.`);
}

// Define slash commands
const commands = [
    new SlashCommandBuilder()
        .setName('warn')
        .setDescription('Warn a user')
        .addUserOption(option => option.setName('user').setDescription('The user to warn').setRequired(true)),

    new SlashCommandBuilder()
        .setName('clearwarn')
        .setDescription('Clear warnings for a user')
        .addUserOption(option => option.setName('user').setDescription('The user to clear warnings for').setRequired(true))
        .addIntegerOption(option => option.setName('amount').setDescription('The amount of warnings to remove.')),

    new SlashCommandBuilder()
        .setName('addblacklistedwords')
        .setDescription('Add words to the blacklist')
        .addStringOption(option => option.setName('words').setDescription('The words to blacklist').setRequired(true)),

    new SlashCommandBuilder().setName('clearblacklist').setDescription('Clear all blacklisted words'),

    new SlashCommandBuilder().setName('currentblacklist').setDescription('Show the current blacklist'),

    new SlashCommandBuilder()
        .setName('automod')
        .setDescription('Toggle automod on or off')
        .addStringOption(option => option.setName('toggle').setDescription('Enable (y) or disable (n)').setRequired(true)),
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
    registerCommandsForGuilds,
};
