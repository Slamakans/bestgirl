module.exports = (client, message, args) => new Promise(async () => {
  const member = message.member || await message.guild.fetchMember(message.author);
  if (!member) return Promise.reject('GuildMember not found');
  let color = args[0];
  const hexRegex = /^#?[0-9A-F]{6}$/i;
  if (color && hexRegex.test(color)) {
    color = color.startsWith('#') ? color : `#${color}`;
    const role = member.roles.filter(isColorRole).first();
    const name = `color ${color.toLowerCase()}`;
    await message.delete();
    if (!role) {
      const newRole = await message.guild.createRole({
        color,
        name,
      });
      await member.addRole(newRole);
    } else {
      await role.edit({
        color,
        name,
      });
    }
    const sentMessage = await message.channel.sendMessage('Done, fam');
    await sentMessage.delete(3000);
  } else {
    await message.delete();
    let response = `Color needs to be of the format \`#RRGGBB\`, where R, G and B can be anything from 0 to F.`;
    response += `\nYou typed: ${color || 'nothing'}`;
    const sentMessage = await message.reply(response);
    await sentMessage.delete(7000);
  }
  return Promise.resolve();
});

const isColorRole = role => role.name.startsWith('color ');
