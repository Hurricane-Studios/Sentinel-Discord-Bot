require('dotenv').config();
const { Client, GatewayIntentBits, Events } = require('discord.js');
const { 
    warnCommand, 
    clearWarnCommand, 
    addBlacklistedWordsCommand, 
    clearBlacklistCommand, 
    currentBlacklistCommand, 
    automodToggleCommand, 
    currentWarnsCommand,
    setBotLogsCommand,
    clearMessagesCommand,  // Import the new clear command
    registerCommandsForGuilds 
} = require('./commands');
const { handleAutoModMessage } = require('./automod');
const { exec } = require('child_process');
const { setBotStatus } = require('./status'); 

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

// Ensure environment variables are set
if (!process.env.DISCORD_TOKEN) {
    console.error('DISCORD_TOKEN is not set. Please check your .env file.');
    process.exit(1);
}

// Register commands for all connected guilds on startup
client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}!`);
    try {
        await registerCommandsForGuilds(client); 
        await setBotStatus(client); 
        console.log('Bot has finished loading!');
    } catch (error) {
        console.error('Error during startup:', error);
    }
});

// Register commands when the bot joins a new guild
client.on(Events.GuildCreate, async guild => {
    try {
        console.log(`Joined new guild: ${guild.name} (${guild.id})`);
        await registerCommandsForGuilds(client, guild.id);
        console.log('Commands registered for new guild.');
    } catch (error) {
        console.error(`Error registering commands for new guild ${guild.name}:`, error);
    }
});

// Log a message when the bot is removed from a guild
client.on(Events.GuildDelete, async guild => {
    console.log(`${guild.name} has removed Sentinel from their server.`);
    await sendLogToBotChannel(guild, `Removed from guild: ${guild.name} (${guild.id})`);
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
        process.exit(0);
    });
}

// Handle slash command interactions
client.on(Events.InteractionCreate, async interaction => {
    try {
        if (interaction.isCommand()) {
            const { commandName } = interaction;

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
                case 'currentwarns':
                    await currentWarnsCommand(interaction);
                    break;
                case 'clearblacklist':
                    await clearBlacklistCommand(interaction);
                    break;
                case 'currentblacklist':
                    await currentBlacklistCommand(interaction);
                    break;
                case 'setbotlogs':
                    await setBotLogsCommand(interaction);
                    break;
                case 'automod':
                    await automodToggleCommand(interaction);
                    break;
                case 'clear':
                    await clearMessagesCommand(interaction);
                    break;
                default:
                    console.warn(`Unknown command: ${commandName}`);
                    await interaction.reply({
                        content: 'Unknown command.',
                        ephemeral: true,
                    });
            }
        } else {
            console.warn('Received unknown interaction type.');
        }
    } catch (error) {
        console.error(`Error handling ${interaction.commandName}:`, error);
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
        if (message.author.bot) return; // Ignore bot messages
        if (!message.guild) return; // Ignore DMs
        await handleAutoModMessage(message);
    } catch (error) {
        console.error('Error in automod message handler:', error);
    }
});

// Send logs to the configured bot log channel
async function sendLogToBotChannel(guild, message) {
    const config = await ensureGuildConfig(guild.id);
    const logChannelId = config.logChannelId;

    if (logChannelId) {
        const channel = await guild.channels.fetch(logChannelId).catch(() => null);
        if (channel) {
            await channel.send(message).catch(console.error);
        }
    }
}

// Log the bot into Discord using the token from the .env file
client.login(process.env.DISCORD_TOKEN);
