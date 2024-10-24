const fs = require('fs').promises;
const path = require('path');

// Path to the botconfig.json file
const configPath = path.join(__dirname, 'botconfig.json');

// Load the status message from botconfig.json
async function getStatusMessage() {
    try {
        const data = await fs.readFile(configPath, 'utf-8');
        const config = JSON.parse(data);
        return config.statusMessage || "No status message set.";
    } catch (error) {
        console.error('Failed to load status message:', error);
        return "Status message unavailable.";
    }
}

// Set the bot's status
async function setBotStatus(client) {
    try {
        const statusMessage = await getStatusMessage();
        // Use await to ensure the promise resolves
        await client.user.setActivity(statusMessage, { type: 'WATCHING' });
        console.log(`Status set to: ${statusMessage}`);
    } catch (error) {
        console.error('Error setting status:', error);
    }
}

module.exports = { setBotStatus };
