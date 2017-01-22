module.exports = async (client, extractURLs, Jimp, nsfwHashes, reaction, user) => {
  if (user.id !== '114758367905447939') { return; }
  try {
    const { message } = reaction;
    const { channel } = message;
    if (!channel.guild) { return; }
    const { emoji } = reaction;
    const nsfw = client.channels.get('256149274465665035');
    if (emoji.name === '🚫' && channel !== nsfw) {
      await message.delete();
      const urls = extractURLs(message.content);
      if (message.attachments.first()) {
        urls.unshift(message.attachments.first().url);
      }
      let response = { content: '0' };
      if (urls.length > 1) {
        (await channel.sendMessage('Specify which images to blacklist')).delete(5000);
        response = (
          await channel.awaitMessages(m => m.author.id === '114758367905447939', {
            maxMatches: 1,
          })
        ).first();
      }
      const indices = response.content.split(' ');
      const toAdd = indices.map(index => urls[index]);
      const hashes = [];
      for (const url of toAdd) {
        hashes.push((await Jimp.read(url)).hash());
      }
      hashes.forEach(url => nsfwHashes.push(url));
      if (response.delete) await response.delete();
      if (hashes.length > 0) {
        (await message.reply(`the image ${
          hashes.length > 1 ?
          's were' :
          'was'
        } added to the blacklist`)).delete(5000);
        for (const url of toAdd) {
          await nsfw.sendFile(url);
        }
      }
    }
  } catch (err) {
    client.emit('error', err);
  }
};
