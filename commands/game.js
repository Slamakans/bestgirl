module.exports = (client, message) => new Promise(async () => {
  const game = message.content.split(' ').slice(1).join(' ');
  await client.user.setGame(game).catch(e => client.emit('error', e));
});
