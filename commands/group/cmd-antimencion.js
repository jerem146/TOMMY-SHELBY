export default {
  command: ['antistatus'],
  category: 'grupo',
  isAdmin: true,

  run: async (client, m, args) => {
    if (!m.isGroup) return m.reply('Solo funciona en grupos')

    const chat = global.db.data.chats[m.chat] ||= {}

    if (!args[0]) {
      return m.reply('Uso:\n.antistatus on\n.antistatus off')
    }

    if (args[0] === 'on') {
      chat.antiStatusMention = true
      m.reply('✅ Anti mención en estados activado')
    } else if (args[0] === 'off') {
      chat.antiStatusMention = false
      m.reply('❌ Anti mención en estados desactivado')
    }
  }
}