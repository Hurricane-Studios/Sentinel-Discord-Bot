import discord
from discord.ext import commands
import json
import os

# Load config settings
with open("config.json", "r") as config_file:
    config = json.load(config_file)

with open("token.json", "r") as token_file:
    token_data = json.load(token_file)

prefix = config.get("prefix", "!")
blacklisted_words = config.get("blacklisted", [])

intents = discord.Intents.default()
intents.message_content = True  # Required to read message content
bot = commands.Bot(command_prefix=prefix, intents=intents)

@bot.event
async def on_ready():
    """Triggered when the bot has connected and is ready."""
    print(f"Logged in as {bot.user}")
    try:
        synced = await bot.tree.sync()  # Sync all slash commands
        print(f"Synced {len(synced)} command(s).")
    except Exception as e:
        print(f"Failed to sync commands: {e}")

    print("Loading cogs...")
    await bot.load_extension("sentinelcmd")  # Load the commands cog

@bot.event
async def on_message(message):
    """Detect blacklisted words and manage user warnings."""
    if message.author == bot.user:
        return  # Ignore messages from the bot itself

    for word in blacklisted_words:
        if word.lower() in message.content.lower():
            await message.delete()  # Delete the blacklisted message

            user_id = str(message.author.id)

            # Load or initialize warnings
            if os.path.exists("warnings.json"):
                with open("warnings.json", "r") as f:
                    user_warnings = json.load(f)
            else:
                user_warnings = {}

            # Increment the warning count for the user
            user_warnings[user_id] = user_warnings.get(user_id, 0) + 1

            # Save the updated warnings to the file
            with open("warnings.json", "w") as f:
                json.dump(user_warnings, f, indent=4)

            # Notify the user about the warning
            await message.channel.send(
                f"{message.author.mention}, you've used a blacklisted word. "
                f"This is warning {user_warnings[user_id]}."
            )

            # Kick the user if they have 3 or more warnings
            if user_warnings[user_id] >= 3:
                await message.channel.send(
                    f"{message.author.mention} has received 3 warnings and will be kicked."
                )
                try:
                    await message.guild.kick(message.author, reason="Reached 3 warnings.")
                except discord.Forbidden:
                    await message.channel.send("I don't have permission to kick this user.")
                except discord.HTTPException as e:
                    await message.channel.send(f"Failed to kick user: {e}")

            break  # Stop checking after the first blacklisted word

    await bot.process_commands(message)  # Process any other commands

# Run the bot with the token
bot.run(token_data["token"])
