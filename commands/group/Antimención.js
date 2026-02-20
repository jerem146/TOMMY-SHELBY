export default {
  command: [],
  category: 'grupo',

  run: async () => {},

  all: async (client, m) => {
    try {
      if (!m.isGroup) return

      // detectar mensaje automático de estado que menciona al grupo
      const isStatusMention =
        m.message?.statusMentionMessage ||
        m.message?.extendedTextMessage?.contextInfo?.statusMention ||
        m.message?.protocolMessage?.type === 25

      if (!isStatusMention) return

      // borrar el mensaje del sistema
      await client.sendMessage(m.chat, { delete: m.key }).catch(()=>{})

    } catch (e) {
      console.log('Error AntiStatusMention:', e)
    }
  }
}