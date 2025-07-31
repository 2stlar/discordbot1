const dotenv = require('dotenv');
const { REST, Routes, ApplicationCommandOptionType, AttachmentBuilder } = require('discord.js');

// Load environment variables
dotenv.config({ path: require('path').join(__dirname, '.env') });

const commands = [
    {
        name: 'role',
        description: 'Create a role and assign it to yourself',
        options: [
            {
                name: 'name',
                description: 'The name of the role',
                type: ApplicationCommandOptionType.String,
                required: true,
            },
            {
                name: 'color',
                description: 'The hex code for the role color (e.g. ff0000)',
                type: ApplicationCommandOptionType.String,
                required: true,
            },
        ],
    },
    {
        name: 'deleterole',
        description: 'Delete a role by name (Admin only)',
        options: [
            {
                name: 'name',
                description: 'The name of the role to delete',
                type: ApplicationCommandOptionType.String,
                required: true,
            },
        ],
    },
    {
        name: 'userrole',
        description: 'Add or remove a role from a user',
        options: [
            {
                name: 'user',
                description: 'The user to modify',
                type: ApplicationCommandOptionType.User,
                required: true,
            },
            {
                name: 'role',
                description: 'The role to add or remove',
                type: ApplicationCommandOptionType.Role,
                required: true,
            },
            {
                name: 'action',
                description: 'Add or remove the role',
                type: ApplicationCommandOptionType.String,
                required: true,
                choices: [
                    { name: 'Add', value: 'add' },
                    { name: 'Remove', value: 'remove' },
                ],
            },
        ],
    },
    {
        name: 'afk',
        description: 'Set your AFK status',
        options: [
            {
                name: 'status',
                description: 'Your custom AFK status (optional, defaults to "AFK")',
                type: ApplicationCommandOptionType.String,
                required: false, // Optional field
            },
        ],
    },
    {
        name: 'embed',
        description: 'Create and send an embed message (Admin only)',
        options: [
            {
                name: 'title',
                description: 'The title of the embed',
                type: ApplicationCommandOptionType.String,
                required: true,
            },
            {
                name: 'description',
                description: 'The description/body of the embed',
                type: ApplicationCommandOptionType.String,
                required: true,
            },
            {
                name: 'color',
                description: 'Hex color for the embed (e.g. ff0000)',
                type: ApplicationCommandOptionType.String,
                required: false,
            },
            {
                name: 'footer',
                description: 'Footer text',
                type: ApplicationCommandOptionType.String,
                required: false,
            },
        ],
    },
    {
        name: 'level',
        description: 'Check the level of a user',
        options: [
            {
                name: 'user',
                description: 'The user to check (optional)',
                type: ApplicationCommandOptionType.User,
                required: false,
            },
        ],
    },
    {
        name: 'leaderboard',
        description: 'Show the top users by level',
        options: [],
    },
    {
        name: 'reload',
        description: 'Push changes to GitHub and restart the bot (Admin only)',
        options: [],
    },
];

const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

(async () => {
    console.log('registering commands...');
    try {
        await rest.put(
            Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
            { body: commands },
        );
        console.log('Successfully registered application commands.');
    } catch (error) {
        console.log(`${error}`);
    }
})();