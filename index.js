require('dotenv').config();
const { Client, GatewayIntentBits, Events } = require('discord.js');
const { 
    warnCommand, 
    clearWarnCommand, 
    addBlacklistedWordsCommand, 
    registerCommandsForGuilds 
} = require('./commands');
const { handleAutoModMessage } = require('./automod'); // Import automod logic

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

// Bot ready event
client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}!`);

    // Register commands dynamically for all connected guilds
    await registerCommandsForGuilds(client);

    console.log('Bot has finished loading!');
});

// Handle slash command interactions
client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isCommand()) return;

    const { commandName } = interaction;

    try {
        // Handle each command with a deferred reply
        if (commandName === 'warn') {
            await interaction.deferReply({ ephemeral: true });
            await warnCommand(interaction);
        } else if (commandName === 'clearwarn') {
            await interaction.deferReply({ ephemeral: true });
            await clearWarnCommand(interaction);
        } else if (commandName === 'addblacklistedwords') {
            await addBlacklistedWordsCommand(interaction);
        }
    } catch (error) {
        console.error(`Error handling ${commandName}:`, error);

        // Handle the error gracefully to avoid InteractionAlreadyReplied issues
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ 
                content: 'An error occurred while executing this command.', 
                ephemeral: true 
            });
        } else {
            console.log(`Interaction for ${commandName} already handled.`);
        }
    }
});

// Handle all messages for automod logic
client.on(Events.MessageCreate, async message => {
    try {
        await handleAutoModMessage(message); // Check for blacklisted words and warn if necessary
    } catch (error) {
        console.error('Error in automod message handler:', error);
    }
});

// Login the bot with token from .env
client.login(process.env.DISCORD_TOKEN);
