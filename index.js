require('dotenv').config(); // Load environment variables
const { handleCommands } = require('./commands'); // Import commands logic
const { handlePunishment } = require('./punishment'); // Import punishment logic

console.log(`Token: ${process.env.DISCORD_TOKEN ? 'Loaded' : 'Not Loaded'}`); // Debug log

const { Client, GatewayIntentBits } = require('discord.js');
const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers]
});

// Triggered when the bot is online
client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
});

// Listen for messages and handle commands or punishment logic
client.on('messageCreate', async (message) => {
    if (!message.author.bot) { // Ignore bot messages
        handleCommands(message); // Handle commands
        await handlePunishment(message); // Check for punishments
    }
});

// Login with the token from the .env file
client.login(process.env.DISCORD_TOKEN);
