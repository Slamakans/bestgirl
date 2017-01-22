module.exports = async (client, o, n) => {
  if (o.presence.game === n.presence.game && o.presence.status === n.presence.status) { return; }
  if (!await client.guilds.get('256134666187177984').fetchMember(o)) {
    return;
  }
  const og = o.presence.game;
  const ng = n.presence.game;
  if ((og && !og.equals(ng)) || (ng && ng.equals(og))) {
    const content = !ng ?
    `**${o.user.username}** stopped playing **${og.name}**` :
    `**${o.user.username}** started playing **${ng.name}**`;
    await client.channels.get('256465934665908226')
    .sendMessage(`[${
      new Date().toTimeString()
      .split(' ')
      .shift()
    }] ${content}`);
  }

  const os = o.presence.status;
  const ns = n.presence.status;
  if (os !== ns) {
    await client.channels.get('256465934665908226')
    .sendMessage(`[${
      new Date().toTimeString()
      .split(' ')
      .shift()
    }] **${o.user.username}** changed status from **${os}** to **${ns}**`);
  }
};
