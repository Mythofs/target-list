const { SlashCommandBuilder } = require("discord.js");
const safeFetch = require("../../safeFetch.js");
const db = require("../../db.js");

module.exports = { 
    data: new SlashCommandBuilder().setName("target").setDescription("Adds/removes player to target list")
        .addIntegerOption((option) => option.setName("playerid").setDescription("The player to add or remove").setRequired(false))
        .addStringOption((option) => option.setName("desc").setDescription("Description").setRequired(false)),
    async execute(interaction) {
        await interaction.deferReply();
        try {
            const playerId = interaction.options.getInteger("playerid");
            const channel = interaction.client.channels.cache.get(process.env.CHANNEL_ID);
            if(playerId === null) {
                const [targets] = await db.execute("SELECT * FROM target_list");
                if(targets.length === 0)
                    return await interaction.editReply("No targets set");
                const ids = targets.map(target => target.id);
                const ffsStats = await safeFetch(`https://ffscouter.com/api/v1/get-stats?key=${process.env.FFSCOUTER_KEY}&targets=${ids.join()}`);
                const ffsMap = new Map(ffsStats.map(stat => [stat.player_id, stat]));
                targets.sort((a, b) => ffsMap.get(b.id).bs_estimate - ffsMap.get(a.id).bs_estimate);
                const replies = [""];
                let index = 0;
                for(const target of targets) {
                    const stats = ffsMap.get(target.id);
                    const s = `\n${stats.bs_estimate_human} (${getTime(stats.last_updated * 1000)}) | [${target.name} (${target.id})](https://www.torn.com/profiles.php?XID=${target.id}) | [Attack](https://www.torn.com/page.php?sid=attack&user2ID=${target.id})`;
                    if(target.desc !== undefined)
                        s += ` | ${target.desc}`;
                    if(replies[index].length + s.length > 2000) {
                        index++;
                        replies[index] = "";
                    }
                    replies[index] += s;
                }
                await interaction.editReply("Current Targets:");
                for(const reply of replies) {
                    await channel.send(reply);
                    return;
                }
            }
            const [targets] = await db.execute("SELECT * FROM target_list WHERE id = ?", [playerId]);
            if(targets.length > 0) {
                await db.execute("DELETE FROM target_list WHERE id = ?", [playerId]);
                return await interaction.editReply(`Deleted ${targets[0].name} (${playerId})`);
            }
            const desc = interaction.options.getString("desc");
            const info = await safeFetch(`https://api.torn.com/user/${playerId}?selections=profile&key=${process.env.API_KEY}`);
            if(desc === null)
                await db.execute("INSERT INTO target_list (id, name) VALUES (?, ?)", [playerId, info.name]);
            else
                await db.execute("INSERT INTO target_list (id, name, desc) VALUES (?, ?, ?)", [playerId, info.name, desc]);
            return await interaction.editReply(`Added ${info.name} (${playerId})`);
        }
        catch(e) {
            console.log(e);
            return await interaction.editReply(`Error ${e}`);
        }
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