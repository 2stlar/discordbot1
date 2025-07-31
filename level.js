require('dotenv').config();
const fs = require('fs').promises; // Use the promises API for async file operations
const mongoose = require('mongoose'); // Import mongoose
const { createCanvas, loadImage } = require('canvas');
const { AttachmentBuilder, EmbedBuilder } = require('discord.js');

// Define the Mongoose schema and model for levels
const levelSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    xp: { type: Number, default: 0 },
    level: { type: Number, default: 1 },
});

const Level = mongoose.model('Level', levelSchema);

// Cooldown map to prevent spamming XP
const xpCooldowns = new Map();

// Connect to MongoDB
async function connectToDatabase() {
    try {
        await mongoose.connect(process.env.MONGO_URI, { keepAlive: true });
        console.log('Connected to MongoDB');
    } catch (error) {
        console.error('Error connecting to MongoDB:', error);
    }
}

// Get a user's level and XP from the database
async function getUserLevel(userId) {
    let userLevel = await Level.findOne({ userId });
    if (!userLevel) {
        userLevel = new Level({ userId });
        await userLevel.save();
    }
    return userLevel;
}

// Add XP to a user and check for level-up
async function addXp(userId, amount) {
    const userLevel = await getUserLevel(userId);
    userLevel.xp += amount;

    let leveledUp = false;
    while (userLevel.xp >= getLevelXp(userLevel.level)) {
        userLevel.xp -= getLevelXp(userLevel.level);
        userLevel.level++;
        leveledUp = true;
    }

    await userLevel.save(); // Save the updated user level to the database
    return leveledUp ? userLevel.level : null;
}

// Calculate XP needed for the next level
function getLevelXp(level) {
    return Math.floor(100 * Math.pow(level, 1.5));
}

// Generate a level card as an image
async function generateLevelCard(user, userLevel) {
    const width = 600;
    const height = 180;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    const xpNeeded = getLevelXp(userLevel.level);
    const progress = Math.min(userLevel.xp / xpNeeded, 1);

    // Background
    ctx.fillStyle = '#23272A';
    ctx.fillRect(0, 0, width, height);

    // Username
    ctx.font = 'bold 28px Sans';
    ctx.fillStyle = '#fff';
    ctx.fillText(user.username, 180, 50);

    // Level
    ctx.font = 'bold 22px Sans';
    ctx.fillStyle = '#FFD700';
    ctx.fillText(`Level: ${userLevel.level}`, 180, 90);

    // XP Bar Background
    ctx.fillStyle = '#000';
    ctx.fillRect(180, 110, 350, 30);

    // XP Bar Progress
    ctx.fillStyle = '#1e704f';
    ctx.fillRect(180, 110, 350 * progress, 30);

    // XP Text
    ctx.font = '16px Sans';
    ctx.fillStyle = '#fff';
    const xpText = `${userLevel.xp} / ${xpNeeded} XP`;
    const textMetrics = ctx.measureText(xpText);
    const xpTextX = 180 + (350 - textMetrics.width) / 2;
    const xpTextY = 130;
    ctx.fillText(xpText, xpTextX, xpTextY);

    // Avatar
    try {
        const avatarURL = user.displayAvatarURL({ extension: 'png', size: 128 });
        const avatar = await loadImage(avatarURL);
        ctx.save();
        ctx.beginPath();
        ctx.arc(90, 90, 64, 0, Math.PI * 2, true);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(avatar, 26, 26, 128, 128);
        ctx.restore();
    } catch (e) {
        console.error('Failed to load avatar:', e);
    }

    return new AttachmentBuilder(canvas.toBuffer(), { name: 'level-card.png' });
}

// Setup the level system
function setupLevelSystem(client) {
    connectToDatabase(); // Connect to MongoDB when the bot starts

    // XP on message
    client.on('messageCreate', async (message) => {
        if (message.author.bot) return;

        const now = Date.now();
        const lastXp = xpCooldowns.get(message.author.id) || 0;

        // 1-minute cooldown for XP
        if (now - lastXp < 60000) return;
        xpCooldowns.set(message.author.id, now);

        const leveledUp = await addXp(message.author.id, Math.floor(Math.random() * 10) + 5); // 5-15 XP per message
        if (leveledUp) {
            message.channel.send(`${message.author} leveled up to **${leveledUp}**! 🎉`);
        }
    });

    // /level command
    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isChatInputCommand()) return;

        if (interaction.commandName === 'level') {
            try {
                await interaction.deferReply();

                const user = interaction.options.getUser('user') || interaction.user;
                const userLevel = await getUserLevel(user.id);
                const attachment = await generateLevelCard(user, userLevel);

                await interaction.editReply({
                    files: [attachment],
                });
            } catch (error) {
                console.error('Error handling /level command:', error);
                await interaction.editReply({
                    content: 'An error occurred while processing your request.',
                });
            }
        }

        if (interaction.commandName === 'leaderboard') {
            try {
                const topUsers = await Level.find().sort({ level: -1, xp: -1 }).limit(10);

                const leaderboardEmbed = new EmbedBuilder()
                    .setTitle('🏆 Leaderboard 🏆')
                    .setColor('#FFD700')
                    .setDescription('Top users by level and XP');

                for (let i = 0; i < topUsers.length; i++) {
                    const user = topUsers[i];
                    let totalXp = user.xp || 0;
                    for (let lvl = 1; lvl < user.level; lvl++) {
                        totalXp += getLevelXp(lvl);
                    }

                    leaderboardEmbed.addFields({
                        name: `#${i + 1} - User ID: ${user.userId}`,
                        value: `**Level:** ${user.level} | **Total XP:** ${totalXp}`,
                        inline: false,
                    });
                }

                await interaction.reply({
                    embeds: [leaderboardEmbed],
                    ephemeral: false,
                });
            } catch (error) {
                console.error('Error handling /leaderboard command:', error);
                await interaction.reply({
                    content: 'An error occurred while processing your request.',
                });
            }
        }
    });
}

// Export functions
module.exports = {
    connectToDatabase,
    getUserLevel,
    addXp,
    getLevelXp,
    generateLevelCard,
    setupLevelSystem,
};