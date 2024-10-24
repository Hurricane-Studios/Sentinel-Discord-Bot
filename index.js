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
} = require('./commands');
const { handleAutoModMessage } = require('./automod');
const { exec } = require('child_process'); // Import child_process

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,           
        GatewayIntentBits.GuildMessages,    
        GatewayIntentBits.MessageContent,   
        GatewayIntentBits.GuildMembers      
    ]
});

// Register commands for all connected guilds on startup
client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}!`);
    try {
        await registerCommandsForGuilds(client); // Bulk registration
        console.log('Bot has finished loading!');
    } catch (error) {
        console.error('Error registering commands:', error);
    }
});

// Register commands when the bot joins a new guild and restart the bot
client.on(Events.GuildCreate, async guild => {
    try {
        console.log(`Joined new guild: ${guild.name} (${guild.id})`);
        await registerCommandsForGuilds(client, guild.id); // Register commands for the new guild

        console.log('Restarting bot to apply new guild settings...');
        restartBot(); // Call the restart function
    } catch (error) {
        console.error(`Error registering commands for new guild ${guild.name}:`, error);
    }
});

// Log a message when the bot is removed from a guild
client.on(Events.GuildDelete, guild => {
    console.log(`${guild.name} has removed Sentinel from their server.`);
});

// Restart the bot by running `node .` again
function restartBot() {
    exec('node .', (error, stdout, stderr) => {
        if (error) {
            console.error(`Error restarting bot: ${error.message}`);
            return;
        }
        if (stderr) {
            console.error(`Stderr: ${stderr}`);
            return;
        }
        console.log(`Stdout: ${stdout}`);
        console.log('Bot has finished restarting and has loaded.');
        process.exit(0); // Exit the current process
    });
}

// Handle slash command interactions
client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isCommand()) return;

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
                content: 'An unexpected error occurred.',
                ephemeral: true,
            });
        }
    }
});

// Monitor incoming messages for automod logic
client.on(Events.MessageCreate, async message => {
    try {
        await handleAutoModMessage(message);
    } catch (error) {
        console.error('Error in automod message handler:', error);
    }
});

// Log the bot into Discord using the token from the .env file
client.login(process.env.DISCORD_TOKEN);
