require('dotenv').config();
const { Client, GatewayIntentBits, Events } = require('discord.js');
const { warnCommand, clearWarnCommand, registerCommandsForGuilds } = require('./commands'); // Ensure all functions are imported

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMembers
    ]
});

client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}!`);
    await registerCommandsForGuilds(client); // Register slash commands dynamically
});

client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isCommand()) return;

    const { commandName } = interaction;

    if (commandName === 'warn') {
        await warnCommand(interaction); // Ensure this function is correctly imported
    } else if (commandName === 'clearwarn') {
        await clearWarnCommand(interaction); // Ensure this function is correctly imported
    }
});

client.login(process.env.DISCORD_TOKEN);
