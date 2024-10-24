const fs = require('fs').promises;
const path = require('path');
const { REST, Routes, SlashCommandBuilder } = require('discord.js');
require('dotenv').config();

// Path to the JSON file storing all guild configurations
const configsPath = path.join(__dirname, 'serverConfigs.json');

// Load all guild configurations from JSON
async function loadConfigs() {
    try {
        const data = await fs.readFile(configsPath, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Failed to load server configs:', error);
        return {}; // Return empty object if the file doesn't exist or is corrupted
    }
}

// Save all guild configurations back to JSON
async function saveConfigs(configs) {
    try {
        await fs.writeFile(configsPath, JSON.stringify(configs, null, 2));
    } catch (error) {
        console.error('Failed to save server configs:', error);
    }
}

// Ensure a guild has a default configuration
async function ensureGuildConfig(guildId) {
    const configs = await loadConfigs();

    if (!configs[guildId]) {
        configs[guildId] = {
            blacklistedWords: [],
            warnedUsers: {},
            automodEnabled: true,
        };
        await saveConfigs(configs);
    }

    return configs[guildId];
}

// Add a warning to a user in a specific guild
async function addWarning(guildId, userId) {
    const configs = await loadConfigs();
    const guildConfig = await ensureGuildConfig(guildId);

    guildConfig.warnedUsers[userId] = (guildConfig.warnedUsers[userId] || 0) + 1;
    configs[guildId] = guildConfig;

    await saveConfigs(configs);
}

// Clear warnings for a user in a specific guild
async function clearWarnings(guildId, userId, amount = 0) {
    const configs = await loadConfigs();
    const guildConfig = await ensureGuildConfig(guildId);

    if (amount <= 0) {
        delete guildConfig.warnedUsers[userId];
    } else {
        guildConfig.warnedUsers[userId] = Math.max(0, (guildConfig.warnedUsers[userId] || 0) - amount);
    }

    configs[guildId] = guildConfig;
    await saveConfigs(configs);
}

// Add blacklisted words to a guild’s config
async function addBlacklistedWords(guildId, words) {
    const configs = await loadConfigs();
    const guildConfig = await ensureGuildConfig(guildId);

    guildConfig.blacklistedWords = [...new Set([...guildConfig.blacklistedWords, ...words])];
    configs[guildId] = guildConfig;

    await saveConfigs(configs);
}

// Clear the blacklist for a guild
async function clearBlacklist(guildId) {
    const configs = await loadConfigs();
    const guildConfig = await ensureGuildConfig(guildId);

    guildConfig.blacklistedWords = [];
    configs[guildId] = guildConfig;

    await saveConfigs(configs);
}

// Toggle automod for a guild
async function toggleAutomod(guildId, isEnabled) {
    const configs = await loadConfigs();
    const guildConfig = await ensureGuildConfig(guildId);

    guildConfig.automodEnabled = isEnabled;
    configs[guildId] = guildConfig;

    await saveConfigs(configs);
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

async function addBlacklistedWordsCommand(interaction) {
    const guildId = interaction.guildId;
    const words = interaction.options.getString('words').split(/\s+/);

    await addBlacklistedWords(guildId, words);
    await interaction.reply(`Added to blacklist: ${words.join(', ')}`);
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

async function registerCommandsForGuilds(client) {
    try {
        console.log('Refreshing commands.');
        const guilds = await client.guilds.fetch();

        for (const guild of guilds.values()) {
            await rest.put(Routes.applicationGuildCommands(process.env.CLIENT_ID, guild.id), { body: commands });
            console.log(`Registered commands for guild: ${guild.name} (${guild.id})`);
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
