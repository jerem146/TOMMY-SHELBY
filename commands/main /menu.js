import { getDevice } from '@whiskeysockets/baileys';
import axios from 'axios';
import moment from 'moment-timezone';
import { bodyMenu, menuObject } from '../../lib/commands.js';

function normalize(text = '') {
  text = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
  return text.endsWith('s') ? text.slice(0, -1) : text;
}

export default {
  command: ['allmenu', 'help', 'menu'],
  category: 'info',
  run: async (client, m, args, usedPrefix, command) => {
    try {

      const now = new Date();
      const tiempo = moment.tz('America/Caracas').format('DD MMM YYYY');
      const tempo = moment.tz('America/Caracas').format('hh:mm A');

      const botId = client?.user?.id.split(':')[0] + '@s.whatsapp.net';
      const botSettings = global.db.data.settings?.[botId] || {};

      const botname = botSettings.botname || 'BOT';
      const namebot = botSettings.namebot || '';
      const banner = botSettings.banner || '';
      const owner = botSettings.owner || '';
      const canalId = botSettings.id || '';
      const canalName = botSettings.nameid || '';
      const link = botSettings.link || '';

      const isOficialBot = botId === client.user.id.split(':')[0] + '@s.whatsapp.net';
      const botType = isOficialBot ? 'Principal/Owner' : 'Sub Bot';

      const users = Object.keys(global.db.data.users || {}).length;
      const device = getDevice(m.key.id);
      const sender = global.db.data.users?.[m.sender]?.name || m.pushName || 'Usuario';
      const time = client.uptime ? formatearMs(Date.now() - client.uptime) : "Desconocido";

      const alias = {
        anime: ['anime','reacciones'],
        downloads: ['downloads','descargas'],
        economia: ['economia','economy','eco'],
        gacha: ['gacha','rpg'],
        grupo: ['grupo','group'],
        nsfw: ['nsfw','+18'],
        profile: ['profile','perfil'],
        sockets: ['sockets','bots'],
        utils: ['utils','utilidades','herramientas']
      };

      const input = normalize(args[0] || '');
      const cat = Object.keys(alias).find(k => alias[k].map(normalize).includes(input));
      const category = `${cat ? ` para \`${cat}\`` : ''}`;

      if (args[0] && !cat) {
        return m.reply(`✧ La categoría *${args[0]}* no existe.\nDisponibles: *${Object.keys(alias).join(', ')}*`);
      }

      const sections = menuObject;
      const content = cat
        ? String(sections[cat] || '')
        : Object.values(sections).map(s => String(s || '')).join('\n\n');

      let menu = bodyMenu
        ? String(bodyMenu || '') + '\n\n' + content
        : content;

      const replacements = {
        $owner: owner || 'Privado',
        $botType: botType,
        $device: device,
        $tiempo: tiempo,
        $tempo: tempo,
        $users: users.toLocaleString(),
        $link: link,
        $cat: category,
        $sender: sender,
        $botname: botname,
        $namebot: namebot,
        $prefix: usedPrefix,
        $uptime: time
      };

      for (const [key, value] of Object.entries(replacements)) {
        menu = menu.replace(new RegExp(`\\${key}`, 'g'), value);
      }

      /* ===== DESCARGAR BANNER COMO BUFFER ===== */
      let thumb = null;
      try {
        if (banner) {
          const res = await axios.get(banner, { responseType: 'arraybuffer' });
          thumb = res.data;
        }
      } catch {}

      /* ===== ENVIAR MENÚ ===== */

      await client.sendMessage(m.chat, {
        text: menu,
        contextInfo: {
          mentionedJid: [m.sender],
          externalAdReply: {
            title: botname,
            body: `${namebot}`,
            thumbnail: thumb,
            mediaType: 1,
            renderLargerThumbnail: true
          }
        }
      }, { quoted: m });

    } catch (e) {
      console.log(e);
      await m.reply(`Error en menú:\n${e.message}`);
    }
  }
};

function formatearMs(ms) {
  const segundos = Math.floor(ms / 1000);
  const minutos = Math.floor(segundos / 60);
  const horas = Math.floor(minutos / 60);
  const dias = Math.floor(horas / 24);
  return [dias && `${dias}d`, `${horas % 24}h`, `${minutos % 60}m`, `${segundos % 60}s`]
    .filter(Boolean)
    .join(" ");
}