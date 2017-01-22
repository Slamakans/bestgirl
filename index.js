const Discord = require('discord.js');
const client = new Discord.Client({
  messageCacheMaxSize: Infinity,
  messageCacheLifetime: 3600 * 24,
  messageSweepInterval: 3600,
});
const fs = require('fs');
const Jimp = require('jimp');
const COMMANDS = {
  color: require('./commands/color.js'),
  hentai: require('./commands/hentai.js'),
  quote: require('./commands/quote.js'),
  ADMIN: {
    purge: require('./commands/purge.js'),
    clear: require('./commands/clear.js'),
    game: require('./commands/game.js'),
    eval: require('./commands/eval.js'),
  },
};

let nsfwHashes;
try {
  nsfwHashes = require('./nsfw_img_hashes.json');
} catch (err) {
  nsfwHashes = [];
}

const prefix = '!';
const isAdmin = member => member.guild.owner === member;

client.on('ready', async () => {
  await client.user.setGame('type !color').catch(e => client.emit('error', e));
  console.log('Bot is logged in and ready.'); // eslint-disable-line
});
client.on('disconnect', () => console.log('Bot is disconnected.')); // eslint-disable-line
client.login(require('./auth.json').token);

client.on('message', async message => {
  try {
    if (!message.guild) { return; }
    if (!message.author) { return; }
    if (message.author.id === client.user.id) { return; }

    const content = message.content.toLowerCase();
    if (!content.startsWith(prefix)) { return; }
    let member = message.member;
    if (!member) {
      member = await message.guild.fetchMember(message.author);
    }

    const { command, args } = processContent(message.content);

    const commandFunction = COMMANDS[command] || (isAdmin(member) && COMMANDS.ADMIN[command]) || null;
    if (commandFunction) {
      await commandFunction(client, message, args);
    }
  } catch (err) {
    client.emit('error', err);
  }
});
client.on('message', async message => {
  try {
    if (message.author && message.author.id === client.user.id) { return; }

    if (!message.guild) { return; }
    if (message.guild.id !== '256134666187177984') { return; }
    const channel = message.channel;
    // const general = message.guild.channels.get(message.guild.id);
    const nsfw = message.guild.channels.get('256149274465665035');
    const urls = extractURLs(message.content.toLowerCase());
    if (!urls.length && !message.attachments.first()) { return; }
    const nsfwUrls = [];
    for (const url of urls) {
      if (isNSFW(url) || await isNSFWHash(url)) {
        nsfwUrls.push(url);
      }
    }
    let nsfwAttachment;
    if (message.attachments.first()) {
      if (await isNSFWHash(message.attachments.first().url)) {
        nsfwAttachment = message.attachments.first();
        nsfwUrls.unshift(nsfwAttachment.url);
      }
    } else { nsfwAttachment = null; }


    // Rerouting NSFW links sent in #general to #nsfw
    if (channel !== nsfw) {
      await reroute(message, nsfw, nsfwAttachment, nsfwUrls);
    }
    // Rerouting ends

    // Archiving starts
    let promise;
    urls.filter(isImageURL).forEach(async url => {
      const targetChannel = await getChannel(message.guild, url);

      if (targetChannel.id !== 'invalid') {
        if (!promise) {
          promise = targetChannel.sendFile(url).catch(e => client.emit('error', e));
        } else {
          promise.then(() => targetChannel.sendFile(url));
        }
      }
    });
    await promise;

    const nonImgUrls = urls.filter(url => !isImageURL(url));
    const grouped = {};
    for (const url of nonImgUrls) {
      const id = (await getChannel(message.guild, url)).id;
      if (!grouped[id]) grouped[id] = [];
      grouped[id].push(url);
    }
    for (const key in grouped) {
      if (key === 'invalid') continue;
      const urls2 = grouped[key];
      if (!urls2[0] || !urls2[0].length) continue;
      await message.guild.channels.get(key).sendMessage(urls.join('\n')).catch(e => client.emit('error', e));
    }
    // Archiving ends
  } catch (err) {
    client.emit('error', err);
  }
});
client.on('userUpdate', async (o, n) => {
  require('./listeners/userUpdate.js')(client, o, n);
});
client.on('presenceUpdate', async (o, n) => {
  require('./listeners/presenceUpdate.js')(client, o, n);
});
client.on('messageReactionAdd', async (reaction, user) => {
  require('./listeners/messageReactionAddBlacklisting.js')(client, extractURLs, Jimp, nsfwHashes, reaction, user);
});

const getChannel = async (guild, url) => new Promise(async (resolve, reject) => {
  const nsfw = guild.channels.find('name', 'nsfw');
  const sfw = guild.channels.find('name', 'sfw-archive');
  const [hentai, porn, fjNSFW, chanNSFW, fj, chan, nsfw_archive] = [
    guild.channels.find('name', 'hentai-archive') || nsfw,
    guild.channels.find('name', 'porn-archive') || nsfw,
    guild.channels.find('name', 'nsfw-funnyjunk-archive') || nsfw,
    guild.channels.find('name', 'nsfw-4chan-archive') || nsfw,
    guild.channels.find('name', 'funnyjunk-archive') || sfw,
    guild.channels.find('name', '4chan-archive') || sfw,
    guild.channels.find('name', 'nsfw-archive') || nsfw,
  ];
  try {
    if (isHentai(url)) {
      return resolve(hentai);
    } else if (isPorn(url)) {
      return resolve(porn);
    } else if (isFJNSFW(url)) {
      return resolve(fjNSFW);
    } else if (isFJ(url)) {
      return resolve(fj);
    } else if (is4Chan(url)) {
      return resolve(chan);
    } else if (is4ChanNSFW(url)) {
      return resolve(chanNSFW);
    } else if (await isNSFWHash(url)) {
      return resolve(nsfw_archive);
    } else {
      return resolve(sfw);
    }
  } catch (err) {
    if (err.message.startsWith('Could not find MIME')) return resolve(sfw);
    return reject(err);
  }
});

const isNSFWHash = async url => new Promise(async (resolve, reject) => {
  try {
    const img = await Jimp.read(url);
    const hash = img.hash();
    const nsfw = !!nsfwHashes.find(h => {
      const distance = Jimp.distance(hash, h);
      client.emit('debug', `pHash image distance: ${distance}`);
      return distance < 0.095;
    });
    if (nsfw) { nsfwHashes.push(hash); }
    return resolve(nsfw);
  } catch (err) {
    if (err.message.startsWith('Unsupported MIME type')) return resolve(false);
    return reject(err);
  }
});
const isNSFW = url => isHentai(url) || isPorn(url) || isFJNSFW(url) || is4ChanNSFW(url);
const isHentai = url => url && /(tsumino|exhentai|e-hentai)/i.test(url);
const isPorn = url => url && /(pornhub|redtube)/i.test(url);
const isFJNSFW = url => url && /(funnyjunk.*?(?:restricted|nsfw))/i.test(url);
const isFJ = url => url && /(fjcdn|funnyjunk(?!.*?restricted|nsfw))/i.test(url);
const is4Chan = url => {
  const sfwBoards = [
    'a', 'c', 'f', 'g', 'k', 'm', 'o', 'p', 'v', 'vg', 'vr', 'w', 'vip', 'cm',
    'lgbt', '3', 'adv', 'an', 'asp', 'biz', 'cgl', 'ck', 'co', 'diy', 'fa', 'fit',
    'gd', 'his', 'int', 'jp', 'lit', 'mlp', 'mu', 'n', 'news', 'out', 'po', 'qst',
    'sci', 'sp', 'tg', 'toy', 'trv', 'tv', 'vp', 'wsg', 'wsr', 'x',
  ];
  const regex = new RegExp(`(i\\.4cdn|boards\\.4chan\\.org)/(${sfwBoards.join('|')})/`, 'i');
  return url && regex.test(url);
};
const is4ChanNSFW = url => {
  const nsfwBoards = [
    'b', 'd', 'e', 'gif', 'h', 'hr', 'r', 's', 't',
    'u', 'wg', 'i', 'ic', 'r9k', 's4s', 'hm', 'y',
    'aco', 'hc', 'pol', 'soc',
  ];
  const regex = new RegExp(`((?:i\\.4cdn|boards\\.4chan)\\.org)/(${nsfwBoards.join('|')})/`, 'i');
  return url && regex.test(url);
};
const isImageURL = url => url && /(jpg|png|gif|jpeg)$/i.test(url);

const urlRegex =
  /((?:https?:\/\/)?(?:www\.)?[-a-zA-Z0-9@:%._\\+~#=]{2,256}\.[a-z]{2,6}\b(?:[-a-zA-Z0-9@:%_\\+.~#?&//=]*))/gi;
const extractURLs = s => {
  if (!s) return [];
  return s.match(urlRegex) || [];
};


setInterval(() => {
  client.emit('debug', `[${
    new Date().toTimeString()
        .split(' ')
        .shift()
  }] ${
    (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)
  } MB`);
}, 30000);

const saveHashes = () => {
  // Remove duplicates
  nsfwHashes = nsfwHashes.filter((e, i, a) => i === a.indexOf(e));
  fs.writeFileSync('nsfw_img_hashes.json', JSON.stringify(nsfwHashes, undefined, 4));
  client.emit('debug', 'Saved nsfw_img_hashes.json');
};
setInterval(saveHashes, 300000);

const reroute = async (message, nsfw, nsfwAttachment, nsfwUrls) => new Promise(async resolve => {
  if (nsfwUrls.length) {
    await message.delete();
    let newContent = message.content;
    for (const nsfwUrl of nsfwUrls) {
      newContent = newContent.replace(nsfwUrl, '[BLACKED]');
    }
    if (nsfwAttachment) {
      await message.reply(newContent || 'that image is on the blacklist')
        .catch(e => client.emit('error', e));
      resolve();
      // resolve(await nsfw.sendFile(nsfwAttachment.url, nsfwUrls.join('\n')));
    } else {
      if (message.attachments.first()) {
        await message.sendFile(message.attachments.first().url, `${message.author}, ${newContent}`)
          .catch(e => client.emit('error', e));
      } else {
        await message.reply(newContent)
          .catch(e => client.emit('error', e));
      }
      resolve();
      // resolve(nsfw.sendMessage(nsfwUrls.join('\n')));
    }
  } else {
    resolve();
  }
});

function processContent(content) {
  const lowercase = content.toLowerCase();
  const args = lowercase.split(' ');
  const command = args.shift().replace(new RegExp(`^${prefix}`, 'i'), '');
  const segments = [[]];
  args.forEach((e, i, a) => {
    if (segments[segments.length - 1].length === 2) segments.push([]);
    if (e.startsWith('"')) segments[segments.length - 1].push(i);
    if (e.endsWith('"')) segments[segments.length - 1].push(i);
    a[i] = e.replace(/(^"|"$)/, '');
  });
  let offset = 0;
  segments.forEach(segment => {
    if (segment.length !== 2) return;
    const start = segment[0];
    const count = 1 + (segment[1] - start);
    const removed = args.splice(start + offset, count);
    args.splice(start + offset, 0, removed.join(' '));
    offset -= count - 1;
  });

  return { command, args };
}

process.on('uncaughtException', console.log);
client.on('error', console.log);
client.on('warn', console.log);
client.on('debug', console.log);
