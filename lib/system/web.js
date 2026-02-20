import {
  Browsers,
  makeWASocket,
  makeCacheableSignalKeyStore,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  jidDecode,
  DisconnectReason,
} from "@whiskeysockets/baileys";
import pino from "pino";
import chalk from "chalk";
import fs from "fs";
import path from "path";
import express from "express";
import { fileURLToPath } from "url";
import NodeCache from "node-cache";
import { startSubBot } from "../subs.js";
import cors from "cors";
import bodyParser from "body-parser";

if (!global.conns) global.conns = [];
const msgRetryCounterCache = new NodeCache({ stdTTL: 0, checkperiod: 0 });
const userDevicesCache = new NodeCache({ stdTTL: 0, checkperiod: 0 });
const groupCache = new NodeCache({ stdTTL: 3600, checkperiod: 300 });
let reintentos = {};

const cleanJid = (jid = "") => jid.replace(/:\d+/, "").split("@")[0];
const basePath = path.join(process.cwd(), "Sessions");

export default async () => {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  const logger = express();
  const PORT = process.env.PORT || 5010;

  const DIGITS = (s = "") => String(s).replace(/\D/g, "");

  function normalizePhoneForPairing(input) {
    let s = DIGITS(input);
    if (!s) return "";
    if (s.startsWith("0")) s = s.replace(/^0+/, "");
    if (s.length === 10 && s.startsWith("3")) s = "57" + s;
    if (s.startsWith("52") && !s.startsWith("521") && s.length >= 12) s = "521" + s.slice(2);
    if (s.startsWith("54") && !s.startsWith("549") && s.length >= 11) s = "549" + s.slice(2);
    return s;
  }

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  logger.use(express.json());
  logger.use(express.static("public"));
  logger.use(cors());
  logger.use(
    bodyParser.json({
      verify: (req, res, buf) => {
        req.rawBody = buf;
      },
    })
  );
  logger.use(express.urlencoded({ extended: true }));

  logger.get("/", (req, res) => {
    res.redirect("/home");
  });

  logger.get("/home", (req, res) => {
    res.sendFile(path.join(__dirname, "html", "index.html"));
  });

  const sockets = new Map();
  const sessions = new Map();

  // 🔹 Inicia o devuelve socket existente
  async function startSocketIfNeeded(phone) {
    if (sockets.has(phone)) return sockets.get(phone);

    const pho = normalizePhoneForPairing(phone);
    const dir = path.join(basePath, "Subs", pho);
    fs.mkdirSync(dir, { recursive: true });

    const { state, saveCreds } = await useMultiFileAuthState(dir);
    const { version } = await fetchLatestBaileysVersion();

    const s = makeWASocket({
      logger: pino({ level: "silent" }),
      printQRInTerminal: false,
      browser: Browsers.macOS("Chrome"),
      auth: state,
      markOnlineOnConnect: true,
      generateHighQualityLinkPreview: true,
      syncFullHistory: false,
      getMessage: async () => "",
      msgRetryCounterCache,
      userDevicesCache,
      cachedGroupMetadata: async (jid) => groupCache.get(jid),
      version,
      keepAliveIntervalMs: 60000,
      maxIdleTimeMs: 120000,
    });

    s.isInit = false;
    s.ev.on("creds.update", saveCreds);

    s.decodeJid = (jid) => {
      if (!jid) return jid;
      const decode = jidDecode(jid) || {};
      return decode.user && decode.server ? decode.user + "@" + decode.server : jid;
    };

    s.ev.on("connection.update", async ({ connection, lastDisconnect, isNewLogin }) => {
      if (isNewLogin) s.isInit = false;

      if (connection === "open") {
        s.isInit = true;
        s.uptime = Date.now();
        s.userId = cleanJid(s.user?.id?.split("@")[0]);
        if (!global.conns.find((c) => c.userId === s.userId)) global.conns.push(s);
        delete reintentos[s.userId || phone];
      }

      if (connection === "close") {
        const botId = s.userId || phone;
        const reason = lastDisconnect?.error?.output?.statusCode || lastDisconnect?.reason || 0;
        const intentos = reintentos[botId] || 0;
        reintentos[botId] = intentos + 1;

        if ([401, 403].includes(reason)) {
          if (intentos < 5) {
            console.log(chalk.gray(`[ ✿ ] ${botId} Conexión cerrada (código ${reason}) intento ${intentos}/5 → Reintentando...`));
            setTimeout(() => startSubBot(null, null, "Auto reinicio", false, pho, null), 3000);
          } else {
            console.log(chalk.gray(`[ ✿ ] ${botId} Falló tras 5 intentos. Eliminando sesión.`));
            try { fs.rmSync(path.join(basePath, "Subs", pho), { recursive: true, force: true }); } catch (e) {}
            delete reintentos[botId];
          }
          return;
        }

        // Reconexión para errores transitorios
        if ([DisconnectReason.connectionClosed, DisconnectReason.connectionLost, DisconnectReason.timedOut, DisconnectReason.connectionReplaced].includes(reason)) {
          setTimeout(() => startSubBot(null, null, "Auto reinicio", false, pho, null), 3000);
          return;
        }

        // Reconexión final
        setTimeout(() => startSubBot(null, null, "Auto reinicio", false, pho, null), 3000);
      }
    });

    sockets.set(phone, s);
    return s;
  }

  // 🔹 Obtener estado de conexión
  async function getStatus(phone) {
    const normalizedPhone = normalizePhoneForPairing(phone);
    const sessionDir = path.join(basePath, "Subs", normalizedPhone, "creds.json");
    const exists = fs.existsSync(sessionDir);
    return { connected: exists, number: exists ? normalizedPhone : "" };
  }

  // 🔹 Request de código de emparejamiento
  async function requestPairingCode(rawPhone) {
    const phoneDigits = normalizePhoneForPairing(rawPhone);
    if (!phoneDigits) throw new Error("Número inválido. Usa solo dígitos con código de país.");
    const s = await startSocketIfNeeded(phoneDigits);
    if (s.user) return null;
    await sleep(1500);
    const code = await s.requestPairingCode(phoneDigits, "STBOTMD1");
    return String(code).match(/.{1,4}/g)?.join("-") || code;
  }

  async function startPairing(rawPhone) {
    const phone = normalizePhoneForPairing(rawPhone);
    const st = await getStatus(phone);
    const numbot = st.number + "@s.whatsapp.net";
    if (!numbot) return { ok: false, message: "Número inválido o no conectado." };
    if (st.connected) return { ok: true, connected: true, number: numbot, message: `✎ Conectado como ${numbot}` };
    const code = await requestPairingCode(phone);
    return { ok: true, connected: false, code, message: `${code}` };
  }

  // 🔹 Configuración de Express y rutas...
  logger.listen(PORT, () => console.log(`🚀 Web server escuchando en puerto ${PORT}`));
};