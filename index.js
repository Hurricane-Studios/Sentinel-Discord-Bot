require('dotenv').config();
const { Client, GatewayIntentBits, Events } = require('discord.js');
const { warnCommand, clearWarnCommand, registerCommandsForGuilds } = require('./commands');
const { handleAutoModMessage } = require('./automod'); // Import automod logic

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}!`);
    await registerCommandsForGuilds(client); // Register slash commands dynamically
});

// Listen for slash command interactions
client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isCommand()) return;

    const { commandName } = interaction;

    if (commandName === 'warn') {
        await warnCommand(interaction);
    } else if (commandName === 'clearwarn') {
        await clearWarnCommand(interaction);
    }
});

// Listen for all messages and handle automod logic
client.on(Events.MessageCreate, async message => {
    await handleAutoModMessage(message); // Check for blacklisted words and warn if necessary
});

client.login(process.env.DISCORD_TOKEN);
