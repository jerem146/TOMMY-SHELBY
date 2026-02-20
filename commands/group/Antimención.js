export default {
  command: [], // sin comando, se ejecuta siempre
  category: 'grupo',
  
  run: async () => {},

  all: async (client, m) => {
    try {
      if (!m.isGroup) return

      const chat = global.db.data.chats[m.chat] || {}
      if (!chat.antiMention) return

      // detectar menciones reales
      const mentioned =
        m.message?.extendedTextMessage?.contextInfo?.mentionedJid ||
        m.message?.imageMessage?.contextInfo?.mentionedJid ||
        m.message?.videoMessage?.contextInfo?.mentionedJid ||
        []

      if (!mentioned.length) return

      // obtener admins
      const meta = await client.groupMetadata(m.chat).catch(()=>null)
      const admins = meta?.participants
        ?.filter(p => p.admin)
        ?.map(p => p.id || p.jid || p.lid) || []

      // ignorar admins
      if (admins.includes(m.sender)) return

      // borrar mensaje
      await client.sendMessage(m.chat, { delete: m.key }).catch(()=>{})

    } catch (e) {
      console.log('Error AntiMention:', e)
    }
  }
}