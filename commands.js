const fs = require('fs');
const path = require('path');
const { REST, Routes, SlashCommandBuilder } = require('discord.js');
require('dotenv').config();

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

// Handle /warn command
async function warnCommand(interaction) {
    const targetUser = interaction.options.getUser('user');
    if (!targetUser) {
        return interaction.reply('Please mention a valid user to warn.', { ephemeral: true });
    }

    const warnings = loadWarnings();
    const userId = targetUser.id;

    warnings[userId] = (warnings[userId] || 0) + 1;
    saveWarnings(warnings);

    await interaction.reply(
        `<@${userId}> has been warned. They now have ${warnings[userId]} warning(s).`
    );
}

// Handle /clearwarn command with the option to remove a specific number of warnings
async function clearWarnCommand(interaction) {
    const targetUser = interaction.options.getUser('user');
    const warnAmount = interaction.options.getInteger('amount') || 0; // Default to 0, meaning remove all warnings

    if (!targetUser) {
        return interaction.reply('Please mention a valid user to clear warnings for.', { ephemeral: true });
    }

    const warnings = loadWarnings();
    const userId = targetUser.id;

    if (warnAmount <= 0 || !warnings[userId]) {
        // If no amount is provided or warnings are 0 or less, clear all warnings
        warnings[userId] = 0;
        await interaction.reply(`All warnings for <@${userId}> have been cleared.`);
    } else {
        // Remove the specified amount of warnings
        warnings[userId] = Math.max(0, warnings[userId] - warnAmount); // Ensure warnings don't go below 0
        await interaction.reply(`<@${userId}> has had ${warnAmount} warning(s) removed. They now have ${warnings[userId]} warning(s).`);
    }

    saveWarnings(warnings);
}

// Define slash commands with additional "amount" option for /clearwarn
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
                .setDescription('The amount of warnings to remove. Leave empty to clear all.')
                .setRequired(false)) // Optional amount to remove
].map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

// Register commands dynamically for all connected guilds
async function registerCommandsForGuilds(client) {
    try {
        console.log('Started refreshing application (/) commands.');

        const guilds = await client.guilds.fetch(); // Fetch all connected guilds

        guilds.forEach(async guild => {
            const guildId = guild.id;

            await rest.put(
                Routes.applicationGuildCommands(process.env.CLIENT_ID, guildId),
                { body: commands }
            );

            console.log(`Successfully registered commands for guild: ${guild.name} (${guildId})`);
        });
    } catch (error) {
        console.error('Error registering commands:', error);
    }
}

module.exports = { warnCommand, clearWarnCommand, registerCommandsForGuilds };
