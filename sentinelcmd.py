import discord
from discord import app_commands
from discord.ext import commands
import json

# Load warnings from the warnings.json file
with open("warnings.json", "r") as f:
    user_warnings = json.load(f)

def save_warnings():
    """Save the current warnings to the warnings.json file."""
    with open("warnings.json", "w") as f:
        json.dump(user_warnings, f, indent=4)

class SentinelCommands(commands.Cog):
    """A cog to manage bot commands."""

    def __init__(self, bot):
        self.bot = bot

    @app_commands.command(name="warnings", description="Check a user's warning count.")
    async def warnings(self, interaction: discord.Interaction, member: discord.Member):
        """
        Slash command to check the warning count for a specific user.
        
        Usage: /warnings <@member>
        Example: /warnings @Swishhyy
        """
        user_id = str(member.id)
        # Get the warning count or return 0 if no warnings exist for this user
        count = user_warnings.get(user_id, 0)
        await interaction.response.send_message(
            f"{member.mention} has {count} warning(s).", ephemeral=True
        )

    @app_commands.command(name="resetwarnings", description="Reset a user's warnings to 0.")
    async def reset_warnings(self, interaction: discord.Interaction, member: discord.Member):
        """
        Slash command to reset the warning count for a specific user.
        
        Usage: /resetwarnings <@member>
        Example: /resetwarnings @Swishhyy
        
        This sets the user's warning count to 0.
        """
        user_id = str(member.id)
        if user_id in user_warnings:
            # Reset the user's warnings and save the changes
            user_warnings[user_id] = 0
            save_warnings()
            await interaction.response.send_message(
                f"{member.mention}'s warnings have been reset.", ephemeral=True
            )
        else:
            # Inform the admin that the user has no warnings to reset
            await interaction.response.send_message(
                f"{member.mention} has no warnings.", ephemeral=True
            )

# Setup function to add this cog to the bot
async def setup(bot):
    """Add the SentinelCommands cog to the bot."""
    await bot.add_cog(SentinelCommands(bot))

