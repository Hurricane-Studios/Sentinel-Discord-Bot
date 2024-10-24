require('dotenv').config();
const { Client, GatewayIntentBits, Events } = require('discord.js');
const { 
    warnCommand, 
    clearWarnCommand, 
    addBlacklistedWordsCommand, 
    registerCommandsForGuilds 
} = require('./commands'); // Import command handlers
const { handleAutoModMessage } = require('./automod'); // Import automod logic

// Create a new Discord client with the necessary intents
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,           // Enables bot to interact within guilds
        GatewayIntentBits.GuildMessages,    // Enables bot to receive guild messages
        GatewayIntentBits.MessageContent,   // Allows reading message content (for automod logic)
        GatewayIntentBits.GuildMembers      // Allows accessing guild member information
    ]
});

// Event triggered once the bot successfully logs in
client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}!`);

    // Register slash commands dynamically for all connected guilds
    try {
        await registerCommandsForGuilds(client);
        console.log('Bot has finished loading!');
    } catch (error) {
        console.error('Error registering commands:', error);
    }
});

// Handle slash command interactions
client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isCommand()) return; // Ignore non-command interactions

    const { commandName } = interaction;

    try {
        // Handle specific commands without unnecessary deferment
        switch (commandName) {
            case 'warn':
                await warnCommand(interaction);
                break;
            case 'clearwarn':
                await clearWarnCommand(interaction);
                break;
            case 'addblacklistedwords':
                await addBlacklistedWordsCommand(interaction);
                break;
            default:
                console.warn(`Unknown command: ${commandName}`);
        }
    } catch (error) {
        console.error(`Error handling ${commandName}:`, error);

        // Ensure we only send a reply if none has been sent yet
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({
                content: 'An unexpected error occurred while executing this command.',
                ephemeral: true, // Only visible to the user
            });
        } else {
            console.log(`Interaction for ${commandName} was already handled.`);
        }
    }
});

// Monitor all incoming messages for automod logic
client.on(Events.MessageCreate, async message => {
    try {
        // Process the message with automod logic
        await handleAutoModMessage(message);
    } catch (error) {
        console.error('Error in automod message handler:', error);
    }
});

// Log the bot into Discord using the token from the .env file
client.login(process.env.DISCORD_TOKEN);
