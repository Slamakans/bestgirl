const fs = require('fs');
let quotes;
try {
  quotes = require('../quotes.json');
} catch (err) {
  console.log(err);
  quotes = {};
}
module.exports = (client, message, args) => new Promise(async () => {
  try {
    const mode = args.shift();
    if (!mode) {
      // Random quote
      const quoteArray = Object.values(quotes).sort((a, b) => a.time_added - b.time_added);
      const index = ~~(Math.random() * quoteArray.length);
      const quote = quoteArray[index];
      if (!quote) {
        (await message.channel.sendMessage('There aren\'t any quotes yet.')).delete(3000);
        return;
      }
      const author = await client.fetchUser(quote.author.id);
      const embed = new (require('discord.js')).RichEmbed();
      embed
        .setAuthor(author.username, author.avatarURL)
        .setColor(author.id % 0x1000000)
        .setDescription(quote.content)
        .setTimestamp(new Date(quote.timestamp))
        .setImage(quote.image)
        .setFooter(`Quote #${index + 1}`, client.user.avatarURL);
      await message.channel.sendEmbed(embed);
    } else if (mode === 'add') {
      // Add quote
      if (message.channel.messages.size < 100) {
        client.emit('debug', 'Fetching messages in channel to build cache for messageReactionAdd');
        await message.channel.fetchMessages({ limit: 100 });
      }
      const instructionMessage = await message.channel.sendMessage(
        'React to the message you want to add with anything.'
      );
      const listenForArrowUp = async (reaction, user) => {
        if (reaction.message.channel.id === message.channel.id && user.id !== message.author.id) { return; }
        client.removeListener('messageReactionAdd', listenForArrowUp);
        const msg = reaction.message;
        quotes[msg.id] = {
          author: {
            id: msg.author.id,
            name: msg.author.username,
            avatarURL: msg.author.avatarURL,
          },
          content: msg.content || undefined,
          timestamp: msg.editedTimestamp || msg.createdTimestamp,
          image: msg.attachments.first() ? msg.attachments.first().url : undefined,
          time_added: Date.now(),
        };
        fs.writeFileSync('quotes.json', JSON.stringify(quotes, undefined, 4));
        await instructionMessage.delete();
        (await message.channel.sendMessage(`Quote added as **#${
          Object.values(quotes).sort((a, b) => a.time_added - b.time_added).length
        }**`)).delete(3000);
      };
      client.on('messageReactionAdd', listenForArrowUp);
    } else if (mode === 'list') {
      const embed = new (require('discord.js')).RichEmbed();
      embed
        .setTitle('Available Quotes')
        .setDescription(
          Object.values(quotes)
            .sort((a, b) => a.time_added - b.time_added)
            .map((quote, index) => `**${`${index + 1}   `.substr(0, 4)}**${
              quote.content && quote.content.length > 30 ?
              `${quote.content.substr(0, 26)} ...` :
              quote.content || '[IMAGE ONLY]'
            }`)
            .join('\n')
        )
        .setColor(0x00AE86)
        .setTimestamp(new Date())
        .setFooter('List of Quotes', client.user.avatarURL);
      (await message.channel.sendEmbed(embed)).delete(30000);
    } else if (!isNaN(Number(mode))) {
      const index = Number(mode) - 1;
      const quoteArray = Object.values(quotes).sort((a, b) => a.time_added - b.time_added);
      const quote = quoteArray[index];
      if (index < 0 || index >= quoteArray.length) {
        (await message.channel.sendMessage('Invalid number')).delete(3000);
      } else {
        const embed = new (require('discord.js')).RichEmbed();
        const author = await client.fetchUser(quote.author.id);
        embed
          .setAuthor(author.name, author.avatarURL)
          .setColor(author.id % 0x1000000)
          .setDescription(quote.content || '')
          .setTimestamp(new Date(quote.timestamp))
          .setImage(quote.image)
          .setFooter(`Quote #${index + 1}`, client.user.avatarURL);
        await message.channel.sendEmbed(embed);
      }
    } else {
      let helpText = '!quote _Picks a random quote and sends it_\n';
      helpText += '!quote add _Adds a new quote_\n';
      helpText += '!quote list _Sends a list of the available quotes_\n';
      helpText += '!quote [number] _Sends the specified quote_';
      (await message.channel.sendMessage(helpText)).delete(15000);
    }
  } catch (err) {
    console.log(err);
  }
});
