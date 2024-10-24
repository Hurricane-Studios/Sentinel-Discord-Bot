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
            // Return early with a reply if the user is not valid
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: 'Please mention a valid user to warn.',
                    ephemeral: true,
                });
            }
            return; // Ensure no further execution happens
        }

        const warnings = await loadWarnings();
        const userId = targetUser.id;

        // Increment warning count
        warnings[userId] = (warnings[userId] || 0) + 1;
        await saveWarnings(warnings);

        // Respond with the updated warning count
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({
                content: `<@${userId}> has been warned. They now have ${warnings[userId]} warning(s).`,
                ephemeral: true,
            });
        }
    } catch (error) {
        console.error('Error in warnCommand:', error);

        // Handle error gracefully if no previous reply was sent
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({
                content: 'An error occurred while warning the user.',
                ephemeral: true,
            });
        } else {
            console.error('Cannot send reply: Interaction already replied or deferred.');
        }
    }
}

// Handle /clearwarn command
async function clearWarnCommand(interaction) {
    try {
        const targetUser = interaction.options.getUser('user'); // Get the user to clear warnings for
        const warnAmount = interaction.options.getInteger('amount') || 0; // Default to 0 if not provided

        // Check if the user is valid
        if (!targetUser) {
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: 'Please mention a valid user to clear warnings for.',
                    ephemeral: true,
                });
            }
            return; // Stop further execution
        }

        const warnings = await loadWarnings(); // Load existing warnings from the JSON file
        const userId = targetUser.id;

        // Check if the user has any warnings
        if (!warnings[userId]) {
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: `<@${userId}> has no warnings to clear.`,
                    ephemeral: true,
                });
            }
            return; // Stop further execution
        }

        // Clear all warnings if amount is 0 or negative
        if (warnAmount <= 0) {
            warnings[userId] = 0;
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: `All warnings for <@${userId}> have been cleared.`,
                    ephemeral: true,
                });
            }
        } else {
            // Subtract the specified amount from the user's warnings
            warnings[userId] = Math.max(0, warnings[userId] - warnAmount);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: `<@${userId}> has had ${warnAmount} warning(s) removed. They now have ${warnings[userId]} warning(s).`,
                    ephemeral: true,
                });
            }
        }

        await saveWarnings(warnings); // Save the updated warnings to the JSON file
    } catch (error) {
        console.error('Error in clearWarnCommand:', error);

        // Only reply if no previous reply or deferment has been sent
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({
                content: 'An error occurred while clearing warnings.',
                ephemeral: true,
            });
        } else {
            console.error('Cannot send reply: Interaction already replied or deferred.');
        }
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

// Handle /clearblacklist command
async function clearBlacklistCommand(interaction) {
    try {
        // Load the current config
        const config = await loadConfig();

        // Reset the blacklist to an empty array
        config.blacklistedWords = [];

        // Save the updated config
        await saveConfig(config);

        // Send a reply confirming the blacklist has been cleared
        await interaction.reply({
            content: 'The blacklist has been cleared.',
            ephemeral: true,
        });

    } catch (error) {
        console.error('Error in clearBlacklistCommand:', error);

        // Ensure only one reply is sent
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({
                content: 'An error occurred while clearing the blacklist.',
                ephemeral: true,
            });
        } else {
            console.error('Cannot send reply: Interaction already replied.');
        }
    }
}

// Handle /currentblacklist command
async function currentBlacklistCommand(interaction) {
    try {
        const config = await loadConfig(); // Load the config

        const blacklist = config.blacklistedWords;

        // Check if the blacklist is empty
        if (blacklist.length === 0) {
            console.log('The Blacklist config is currently empty. Please add blacklisted words...'); // Log message

            await interaction.reply({
                content: 'The blacklist is currently empty. Please add blacklisted words...',
                ephemeral: true, // Visible only to the user
            });
        } else {
            // Send the blacklist to the user
            await interaction.reply({
                content: `Current blacklist: ${blacklist.join(', ')}`,
                ephemeral: true, // Visible only to the user
            });
        }
    } catch (error) {
        console.error('Error in currentBlacklistCommand:', error);

        // Handle the error gracefully
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({
                content: 'An error occurred while fetching the blacklist.',
                ephemeral: true,
            });
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
                .setRequired(true)),

    new SlashCommandBuilder()
        .setName('clearblacklist')
        .setDescription('Clear all blacklisted words'),

    new SlashCommandBuilder() // Register the new command
        .setName('currentblacklist')
        .setDescription('Show the current list of blacklisted words')

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
    clearBlacklistCommand,
    currentBlacklistCommand,
    registerCommandsForGuilds,
};
