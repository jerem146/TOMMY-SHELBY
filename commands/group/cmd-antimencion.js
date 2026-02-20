export default {
  command: ['antimention'],
  category: 'grupo',
  isAdmin: true,

  run: async (client, m, args) => {
    if (!m.isGroup) return m.reply('Solo funciona en grupos')

    const chat = global.db.data.chats[m.chat] ||= {}

    if (!args[0]) {
      return m.reply('Uso:\n.antimention on\n.antimention off')
    }

    if (args[0] === 'on') {
      chat.antiMention = true
      m.reply('✅ Anti-mención activado')
    } else if (args[0] === 'off') {
      chat.antiMention = false
      m.reply('❌ Anti-mención desactivado')
    }
  }
}