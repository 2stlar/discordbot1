const dotenv = require('dotenv');
const path = require('path');
const { Client, IntentsBitField, EmbedBuilder, ActivityType } = require('discord.js');
const fs = require('fs');
const { setupLevelSystem } = require('./level'); // Import the level system
const { exec } = require('child_process'); // Import child_process for executing shell commands
// Load environment variables
dotenv.config({ path: path.join(__dirname, '.env') });

// Debugging: Log the filename and directory
console.log('Filename:', __filename);
console.log('Directory:', __dirname);

// Define paths for AFK data
const AFK_FILE = path.join(__dirname, 'afk.json');

// Initialize the Discord client
const client = new Client({
    intents: [
        IntentsBitField.Flags.Guilds,
        IntentsBitField.Flags.GuildMembers,
        IntentsBitField.Flags.GuildMessages,
        IntentsBitField.Flags.MessageContent,
    ],
});

const afkMap = new Map();

function loadAfkMap() {
    if (fs.existsSync(AFK_FILE)) {
        try {
            const data = JSON.parse(fs.readFileSync(AFK_FILE, 'utf8'));
            for (const [userId, value] of Object.entries(data)) {
                afkMap.set(userId, value);
            }
        } catch (e) {
            console.error('Failed to load AFK data:', e);
        }
    }
}

function saveAfkMap() {
    const obj = Object.fromEntries(afkMap.entries());
    fs.writeFileSync(AFK_FILE, JSON.stringify(obj, null, 2));
}

// Load AFK data from file
loadAfkMap();

client.on('ready', () => {
    console.log('Bot online');
    
    client.user.setActivity({
        name: 'Bee Music - Yuno Miles',
        type: ActivityType.Streaming,
        url: 'https://www.youtube.com/watch?v=DxT9ufmYnS8',
    });
});

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'role') {
        const roleName = interaction.options.getString('name');
        let roleColor = interaction.options.getString('color');

        // Allow color with or without #
        if (roleColor.startsWith('#')) {
            roleColor = roleColor.slice(1);
        }

        // Validate hex color (6 hex digits, no #)
        if (!/^([0-9A-F]{6})$/i.test(roleColor)) {
            await interaction.reply({ content: 'Invalid hex color! Use 6 hex digits, e.g. ff0000 or #ff0000', ephemeral: true });
            return;
        }

        await interaction.reply({
            content: `Creating role **${roleName}** with color **#${roleColor}**...`,
            ephemeral: true,
        });

        try {
            const role = await interaction.guild.roles.create({
                name: roleName,
                color: `#${roleColor}`,
                reason: `Created by ${interaction.user.tag} via /role command`,
            });

            await interaction.member.roles.add(role);

            await interaction.editReply({
                content: `Role <@&${role.id}> created and assigned to you!`,
            });
        } catch (err) {
            await interaction.editReply({
                content: `Failed to create or assign role: ${err.message}`,
            });
        }
    }

    if (interaction.commandName === 'deleterole') {
        // Check for Administrator permission
        if (!interaction.member.permissions.has('Administrator')) {
            await interaction.reply({ content: 'You need Administrator permission to use this command.', ephemeral: true });
            return;
        }

        const roleName = interaction.options.getString('name');
        const role = interaction.guild.roles.cache.find(r => r.name === roleName);

        if (!role) {
            await interaction.reply({ content: `Role "${roleName}" not found.`, ephemeral: true });
            return;
        }

        try {
            await role.delete(`Deleted by ${interaction.user.tag} via /deleterole command`);
            await interaction.reply({ content: `Role "${roleName}" has been deleted.`, ephemeral: true });
        } catch (err) {
            await interaction.reply({ content: `Failed to delete role: ${err.message}`, ephemeral: true });
        }
    }

    if (interaction.commandName === 'userrole') {
        // Only allow admins to use this command
        if (!interaction.member.permissions.has('Administrator')) {
            await interaction.reply({ content: 'You need Administrator permission to use this command.', ephemeral: true });
            return;
        }

        const targetUser = interaction.options.getMember('user');
        const role = interaction.options.getRole('role');
        const action = interaction.options.getString('action');

        if (!role.editable) {
            await interaction.reply({ content: 'I cannot manage that role. Make sure my role is higher than the target role.', ephemeral: true });
            return;
        }

        try {
            if (action === 'add') {
                await targetUser.roles.add(role);
                await interaction.reply({ content: `Role <@&${role.id}> added to ${targetUser}.`, ephemeral: true });
            } else if (action === 'remove') {
                await targetUser.roles.remove(role);
                await interaction.reply({ content: `Role <@&${role.id}> removed from ${targetUser}.`, ephemeral: true });
            } else {
                await interaction.reply({ content: 'Invalid action.', ephemeral: true });
            }
        } catch (err) {
            await interaction.reply({ content: `Failed to modify role: ${err.message}`, ephemeral: true });
        }
    }

    if (interaction.commandName === 'afk') {
        // Get the custom AFK status from the command options
        const status = interaction.options.getString('status') || 'AFK'; // Default to "AFK" if no status is provided

        // Save the AFK status in the map
        afkMap.set(interaction.user.id, {
            status: status,
            since: Date.now(),
        });
        saveAfkMap(); // Save the updated AFK map to the file

        // Notify the user that their AFK status has been set
        await interaction.reply({
            content: `${interaction.user} is now AFK: **${status}**`,
            ephemeral: false,
        });
    }

    if (interaction.commandName === 'embed') {
        if (!interaction.member.permissions.has('Administrator')) {
            await interaction.reply({ content: 'You need Administrator permission to use this command.', ephemeral: true });
            return;
        }

        const title = interaction.options.getString('title');
        const description = interaction.options.getString('description');
        let color = interaction.options.getString('color') || '0099ff';
        const footer = interaction.options.getString('footer');

        // Allow color with or without #
        if (color.startsWith('#')) color = color.slice(1);
        if (!/^([0-9A-F]{6})$/i.test(color)) color = '0099ff';

        const embed = new EmbedBuilder()
            .setTitle(title)
            .setDescription(description)
            .setColor(`#${color}`);

        if (footer) embed.setFooter({ text: footer });

        await interaction.reply({ embeds: [embed] });
    }

    if (interaction.commandName === 'reload') {
        if (!interaction.member.permissions.has('Administrator')) {
            await interaction.reply({ content: 'You need Administrator permission to use this command.', ephemeral: true });
            return;
        }

        await interaction.reply({ content: 'Reloading bot... Changes will be pushed to GitHub and the bot will restart.', ephemeral: true });

        // Execute Git commands and restart the bot
        exec('git add . && git commit -m "Bot reload via /reload command" && git push && tmux send-keys -t 0 C-c "node index.js" Enter', (error, stdout, stderr) => {
            if (error) {
                console.error('Error during reload:', error);
                interaction.followUp({ content: `Failed to reload the bot: ${error.message}`, ephemeral: true });
                return;
            }

            console.log('Reload output:', stdout);
            console.error('Reload errors:', stderr);
        });
    }
});

client.on('messageCreate', async (message) => {
    try {
        if (message.author.bot) return;

        // Check if the user has an AFK status
        if (afkMap.has(message.author.id)) {
            const afkData = afkMap.get(message.author.id);
            const afkDuration = formatDuration(Date.now() - afkData.since);

            // Remove the AFK status
            afkMap.delete(message.author.id);
            saveAfkMap(); // Save the updated AFK map to the file

            // Notify the user that their AFK status has been removed
            await message.reply({
                content: `Welcome back, ${message.author}! **${afkData.status}** (for **${afkDuration}**).`,
                ephemeral: false,
            });
        }

        // Check if the mentioned users have an AFK status
        const mentionedUsers = message.mentions.users;
        mentionedUsers.forEach((user) => {
            if (afkMap.has(user.id)) {
                const afkData = afkMap.get(user.id);
                const afkDuration = formatDuration(Date.now() - afkData.since);

                message.channel.send({
                    content: `${user.username} is currently AFK: **${afkData.status}** (for **${afkDuration}**).`,
                });
            }
        });
    } catch (err) {
        console.error('Error in messageCreate:', err);
    }
});

// Helper function to format duration in a readable way
function formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    const daysText = days > 0 ? `${days}d` : '';
    const hoursText = hours % 24 > 0 ? `${hours % 24}h` : '';
    const minutesText = minutes % 60 > 0 ? `${minutes % 60}m` : '';
    const secondsText = seconds % 60 > 0 ? `${seconds % 60}s` : '';

    return [daysText, hoursText, minutesText, secondsText].filter(Boolean).join(' ');
}

// Save AFK data to file every 10 minutes
setInterval(() => {
    saveAfkMap();
}, 10 * 60 * 1000);

// Call the setup function to initialize the level system
setupLevelSystem(client);

client.login(process.env.TOKEN);