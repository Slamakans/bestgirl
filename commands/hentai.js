const parseXML = require('xml2js').parseString;
const request = require('superagent');

module.exports = (client, message, args) => new Promise(async () => {
  const amount = Math.max(1, Math.min(isNaN(Number(args[0])) ? 1 : args.shift(), 5));
  const tags = encodeURIComponent(args.join(' '));
  const baseUrl = 'http://gelbooru.com/index.php?page=dapi&s=post&q=index&limit=1';
  request(`${baseUrl}&tags=${tags}`).end(async (err, res) => {
    if (err) return message.channel.sendMessage(err.message).catch(e => client.emit('error', e));
    parseXML(res.text, async (err2, obj) => {
      if (err2) return message.channel.sendMessage(err.stack).catch(e => client.emit('error', e));
      const count = parseInt(obj.posts.$.count);
      const requests = Array(amount)
                      .join(',1')
                      .split(',')
                      .map(() => `${baseUrl}&pid=${~~(Math.random() * count) + 1}&tags=${tags}`);
      const posts = [];
      const isDone = async () => new Promise(r => setTimeout(() => r(posts.length === amount), 1));
      for (const r of requests) {
        request(r).end(async (err3, res2) => {
          if (err3) return message.channel.sendMessage(err3.stack).catch(e => client.emit('error', e));
          return parseXML(res2.text, (err4, obj2) => {
            if (err4) return message.channel.sendMessage(err4.stack).catch(e => client.emit('error', e));
            return posts.push(obj2.posts.post[0].$.file_url);
          });
        });
      }
      await new Promise(async resolve => {
        while (!await isDone()) {} // eslint-disable-line no-empty
        resolve();
      });
      if (posts.length) {
        return await message.channel.sendMessage(posts.join('\n'));
      }
      // ERROR: No posts found.
      return Promise.reject('No posts found');
    });
    return Promise.resolve();
  });
});
