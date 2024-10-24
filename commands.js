const fs = require('fs').promises; // Use promises API for async file handling
const path = require('path');
const { REST, Routes, SlashCommandBuilder } = require('discord.js');
require('dotenv').config();

// Paths for the JSON files
const warningsPath = path.join(__dirname, 'warnings.json');
const configPath = path.join(__dirname, 'config.json');

// Load warnings from JSON asynchronously
async function loadWarnings() {
    try {
        const data = await fs.readFile(warningsPath, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Failed to load warnings:', error);
        return {}; // Return empty object if file doesn't exist or is corrupted
    }
}

// Save warnings to JSON asynchronously
async function saveWarnings(warnings) {
    try {
        await fs.writeFile(warningsPath, JSON.stringify(warnings, null, 2));
    } catch (error) {
        console.error('Failed to save warnings:', error);
    }
}

// Load config from JSON asynchronously
async function loadConfig() {
    try {
        const data = await fs.readFile(configPath, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Failed to load config:', error);
        return { blacklistedWords: [] }; // Default to an empty blacklist
    }
}

// Save config to JSON asynchronously
async function saveConfig(config) {
    try {
        await fs.writeFile(configPath, JSON.stringify(config, null, 2));
    } catch (error) {
        console.error('Failed to save config:', error);
    }
}

// Handle /warn command
async function warnCommand(interaction) {
    try {
        const targetUser = interaction.options.getUser('user');
        if (!targetUser) {
            return interaction.reply('Please mention a valid user to warn.', { ephemeral: true });
        }

        const warnings = await loadWarnings();
        const userId = targetUser.id;

        warnings[userId] = (warnings[userId] || 0) + 1;
        await saveWarnings(warnings);

        await interaction.reply(
            `<@${userId}> has been warned. They now have ${warnings[userId]} warning(s).`
        );
    } catch (error) {
        console.error('Error in warnCommand:', error);
        await interaction.reply('An error occurred while warning the user.', { ephemeral: true });
    }
}

// Handle /clearwarn command
async function clearWarnCommand(interaction) {
    try {
        const targetUser = interaction.options.getUser('user');
        const warnAmount = interaction.options.getInteger('amount') || 0;

        if (!targetUser) {
            return interaction.reply('Please mention a valid user to clear warnings for.', { ephemeral: true });
        }

        const warnings = await loadWarnings();
        const userId = targetUser.id;

        if (warnAmount <= 0 || !warnings[userId]) {
            warnings[userId] = 0;
            await interaction.reply(`All warnings for <@${userId}> have been cleared.`);
        } else {
            warnings[userId] = Math.max(0, warnings[userId] - warnAmount);
            await interaction.reply(
                `<@${userId}> has had ${warnAmount} warning(s) removed. They now have ${warnings[userId]} warning(s).`
            );
        }

        await saveWarnings(warnings);
    } catch (error) {
        console.error('Error in clearWarnCommand:', error);
        await interaction.reply('An error occurred while clearing warnings.', { ephemeral: true });
    }
}

// Handle /addblacklistedwords command
async function addBlacklistedWordsCommand(interaction) {
    console.log('Received /addblacklistedwords command');

    const words = interaction.options.getString('words');
    if (!words || words.trim() === '') {
        console.log('No valid words provided');
        // Ensure this is the only reply sent
        return interaction.reply({ content: 'Please provide valid words to add to the blacklist.', ephemeral: true });
    }

    try {
        const config = await loadConfig();
        const newWords = words.split(/\s+/).filter(word => word.trim() !== '');

        if (newWords.length === 0) {
            console.log('No new words found after filtering');
            // Ensure this is the only reply sent
            return interaction.reply({ content: 'No valid words provided.', ephemeral: true });
        }

        // Add new words to the blacklist, avoiding duplicates
        config.blacklistedWords = [...new Set([...config.blacklistedWords, ...newWords])];
        await saveConfig(config);

        console.log(`Added words: ${newWords.join(', ')}`);

        // Ensure this is the only reply sent
        await interaction.reply({
            content: `The following words have been added to the blacklist: ${newWords.join(', ')}`,
            ephemeral: true,
        });
    } catch (error) {
        console.error('Error handling addblacklistedwords command:', error);
        
        // Only reply if no reply has been sent yet
        if (!interaction.replied) {
            await interaction.reply({
                content: 'An error occurred while adding words to the blacklist.',
                ephemeral: true,
            });
        } else {
            console.error('Cannot send reply: Interaction already replied.');
        }
    }
}


// Define and register slash commands
const commands = [
    new SlashCommandBuilder()
        .setName('warn')
        .setDescription('Warn a user')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to warn')
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
                .setRequired(false)),

    new SlashCommandBuilder()
        .setName('addblacklistedwords')
        .setDescription('Add words to the blacklist')
        .addStringOption(option =>
            option.setName('words')
                .setDescription('The words to blacklist, separated by spaces')
                .setRequired(true))
].map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

async function registerCommandsForGuilds(client) {
    try {
        console.log('Started refreshing application (/) commands.');
        const guilds = await client.guilds.fetch();

        for (const guild of guilds.values()) {
            await rest.put(
                Routes.applicationGuildCommands(process.env.CLIENT_ID, guild.id),
                { body: commands }
            );
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
    registerCommandsForGuilds
};
