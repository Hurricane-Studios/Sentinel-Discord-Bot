require('dotenv').config();
const { Client, GatewayIntentBits, Events } = require('discord.js');
const { 
    warnCommand, 
    clearWarnCommand, 
    addBlacklistedWordsCommand, 
    clearBlacklistCommand, 
    currentBlacklistCommand, 
    automodToggleCommand, 
    registerCommandsForGuilds 
} = require('./commands'); // Import command handlers
const { handleAutoModMessage } = require('./automod'); // Import automod logic

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

    // Register commands for all connected guilds
    try {
        await registerCommandsForGuilds(client);
        console.log('Bot has finished loading!');
    } catch (error) {
        console.error('Error registering commands:', error);
    }
});

// Register commands when the bot joins a new guild
client.on(Events.GuildCreate, async guild => {
    try {
        console.log(`Joined new guild: ${guild.name} (${guild.id})`);
        await registerCommandsForGuilds(client, guild.id);
    } catch (error) {
        console.error(`Error registering commands for new guild ${guild.name}:`, error);
    }
});

// Handle slash command interactions
client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isCommand()) return; // Ignore non-command interactions

    const { commandName } = interaction;

    try {
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
            case 'clearblacklist':
                await clearBlacklistCommand(interaction);
                break;
            case 'currentblacklist':
                await currentBlacklistCommand(interaction);
                break;
            case 'automod':
                await automodToggleCommand(interaction);
                break;
            default:
                console.warn(`Unknown command: ${commandName}`);
        }
    } catch (error) {
        console.error(`Error handling ${commandName}:`, error);

        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({
                content: 'An unexpected error occurred while executing this command.',
                ephemeral: true,
            });
        }
    }
});

// Monitor incoming messages for automod logic
client.on(Events.MessageCreate, async message => {
    try {
        await handleAutoModMessage(message); // Process message with automod logic
    } catch (error) {
        console.error('Error in automod message handler:', error);
    }
});

// Log the bot into Discord using the token from the .env file
client.login(process.env.DISCORD_TOKEN);
