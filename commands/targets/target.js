const { SlashCommandBuilder } = require("discord.js");
const { AsciiTable3 } = require("ascii-table3");
const db = require("../../db.js");

module.exports = { 
    data: new SlashCommandBuilder().setName("target").setDescription("Adds/removes player to target list")
        .addIntegerOption((option) => option.setName("playerId").setDescription("The player to add or remove").setRequired(false)),
    async execute(interaction) {
        await interaction.deferReply();
        const playerId = interaction.options.getInteger("playerId");
        const channel = interaction.client.channels.cache.get(process.env.CHANNEL_ID);
        if(playerId === null) {
            const [targets] = await db.execute("SELECT * FROM target_list");
            targets.sort((a, b) => a.totalbs - b.totalbs);
            const ids = targets.map(target => target.id);
            const ffsStats = await safeFetch(`https://ffscouter.com/api/v1/get-stats?key=${process.env.FFSCOUTER_KEY}&targets=${ids.join()}`);
            const ffsMap = new Map(ffsStats.map(stat => [stat.id, stat]));
            const replies = [];
            let index = 0;
            for(const target of targets) {
                const stats = ffsMap.get(target.id);
                const s = `${stats.bs_estimate_human} (${getTime(stats.timestamp * 1000)})| \n[${target.name} (${target.id})](https://www.torn.com/profiles.php?XID=${target.id}) [Attack](https://www.torn.com/page.php?sid=attack&user2ID=${target.id})`;
                if(replies[index].length + s.length > 2000) {
                    index++;
                    replies[index] = "";
                }
                replies[index] += s;
            }
            for(const reply of replies) {
                await interaction.reply("Current Targets:");
                await channel.send(reply);
                return;
            }
        }
        const [targets] = await db.execute("SELECT * FROM target_list WHERE id = ?", [playerId]);
        if(targets.length > 0) {
            await db.execute("DELETE FROM target_list WHERE id = ?", [playerId]);
            return await interaction.reply(`Deleted ${targets[0].name} (${playerId})`);
        }
        const info = await safeFetch(`https://api.torn.com/user/${playerId}?selections=profile&key=${process.env.API_KEY}`);
        await db.execute("INSERT INTO target_list VALUES (?, ?)", [playerId, info.name]);
        return await interaction.reply(`Added ${info.name} (${playerId})`);
    },
};
function getTime(timestamp) {
    const diff = Date.now() - new Date(timestamp).getTime();

    const units = [
        { unit: 'year', ms: 31536000000 },
        { unit: 'month', ms: 2592000000 },
        { unit: 'day', ms: 86400000 },
        { unit: 'hour', ms: 3600000 },
        { unit: 'minute', ms: 60000 },
        { unit: 'second', ms: 1000 }
    ];

    const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'always' });

    for (const { unit, ms } of units) {
        const interval = Math.floor(diff / ms);
        if (interval >= 1) {
            return rtf.format(-interval, unit);
        }
    }
    return 'just now';
}