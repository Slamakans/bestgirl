module.exports = async (client, o, n) => {
  if (o.username === n.username) { return; }
  if (!await client.guilds.get('256134666187177984').fetchMember(o)) {
    return;
  }
  await client.channels.get('256465934665908226')
  .sendMessage(`[${
    new Date().toTimeString()
    .split(' ')
    .shift()
  }] **${o.username}** changed name to **${n.username}**`);
};
