const axios = require('axios');
const validUrl = require('valid-url');
const fs = require('fs-extra');
const path = require('path');

// ⚙️ ENDPOINTS & APIS
const CHAT_API = "https://xalman-apis.vercel.app/api/nova-ai?prompt=";
const LYRICS_API = "https://xalman-apis.vercel.app/api/lyrics?song=";
const API_URL_SOURCE = "https://raw.githubusercontent.com/Saim-x69x/sakura/main/ApiUrl.json";

// 👑 OWNER ID
const OWNER_ID = "61590788725790";

const CACHE_DIR = path.join(__dirname, "cache");
if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR);

// 🎨 STICKERS D'ACCUEIL ALEATOIRES
const AI_STICKERS = [
  "840344401663222",
  "840349011662761",
  "840418818322447",
  "404687910535",
  "840419971655665",
  "840421648322164",
  "840417168322612"
];

// 💖 FONT SAFE
function font(text) {
  const map = {
    a:"𝖺", b:"𝖻", c:"𝖼", d:"𝖽", e:"𝖾",
    f:"𝖿", g:"𝗀", h:"𝗁", i:"𝗂", j:"𝗃",
    k:"𝗄", l:"𝗅", m:"𝗆", n:"𝗇", o:"𝗈",
    p:"𝗉", q:"𝗊", r:"𝗋", s:"𝗌", t:"𝗍",
    u:"𝗎", v:"𝗏", w:"𝗐", x:"𝗑", y:"𝗒",
    z:"𝗓"
  };
  return String(text)
    .split("")
    .map(c => map[c.toLowerCase()] || c)
    .join("");
}

// 🌐 RECURING API URL FOR IMAGES
async function getApiUrl() {
  const res = await axios.get(API_URL_SOURCE);
  return res.data.apiv3;
}

// 🔄 URL TO BASE64
async function urlToBase64(url) {
  const res = await axios.get(url, { responseType: "arraybuffer" });
  return Buffer.from(res.data).toString("base64");
}

// 🎨 GENERATE / EDIT IMAGE (LOGIQUE DYNAMIQUE SAKURA)
const handleImageGenerationOrEdit = async (api, event, message, prompt) => {
  const repliedImage = event.messageReply?.attachments?.[0];

  if (!prompt) {
    return message.reply(`🤖 𝗦𝗵𝗮𝗱𝗲 𝗔𝗜\n━━━━━━━━━\n\n${font("Veuillez fournir une description/prompt pour l'image 😎")}`);
  }

  const processingMsg = await message.reply(`🤖 𝗦𝗵𝗮𝗱𝗲 𝗔𝗜\n━━━━━━━━━\n\n${font("Traitement de votre image en cours... ⏳")}`);
  const imgPath = path.join(CACHE_DIR, `${Date.now()}_image.jpg`);

  try {
    const API_URL = await getApiUrl();
    const payload = {
      prompt: repliedImage 
        ? `Edit the given image based on this description:\n${prompt}` 
        : `Create a high quality image based on this description:\n${prompt}`,
      format: "jpg"
    };

    if (repliedImage && repliedImage.type === "photo") {
      payload.images = [await urlToBase64(repliedImage.url)];
    }

    const res = await axios.post(API_URL, payload, {
      responseType: "arraybuffer",
      timeout: 180000
    });

    await fs.ensureDir(path.dirname(imgPath));
    await fs.writeFile(imgPath, Buffer.from(res.data));
    await api.unsendMessage(processingMsg.messageID);

    return message.reply({
      body: `🤖 𝗦𝗵𝗮𝗱𝗲 𝗔𝗜\n━━━━━━━━━\n\n${font(repliedImage ? `Image éditée avec succès ! ✨\nPrompt : ${prompt}` : `Image générée avec succès ! ✨\nPrompt : ${prompt}`)}`,
      attachment: fs.createReadStream(imgPath)
    });
  } catch (error) {
    console.error("AI Image Error:", error?.response?.data || error.message);
    await api.unsendMessage(processingMsg.messageID);
    return message.reply(`🤖 𝗦𝗵𝗮𝗱𝗲 𝗔𝗜\n━━━━━━━━━\n\n${font("Échec du traitement de l'image. Veuillez réessayer plus tard. ❌")}`);
  } finally {
    if (fs.existsSync(imgPath)) {
      await fs.remove(imgPath);
    }
  }
};

// 🎵 SEARCH LYRICS
const handleLyrics = async (api, event, message, songName) => {
  if (!songName) {
    return message.reply(`🤖 𝗦𝗵𝗮𝗱𝗲 𝗔𝗜\n━━━━━━━━━\n\n${font("Donne-moi le titre d'une chanson mon pote ! 🎵")}`);
  }

  api.setMessageReaction("⏳", event.messageID, () => {}, true);

  try {
    const res = await axios.get(`${LYRICS_API}${encodeURIComponent(songName)}`);
    const data = res.data;

    let lyricsText = "";
    let songTitle = songName;
    let artistName = "";

    if (typeof data === 'string') {
      lyricsText = data;
    } else if (data && typeof data === 'object') {
      songTitle = data.title || data.songName || data.song || songName;
      artistName = data.artist || data.singer || "";
      
      const rawLyrics = data.lyrics || data.result || data.response || data.data;
      if (typeof rawLyrics === 'object' && rawLyrics !== null) {
        lyricsText = rawLyrics.lyrics || rawLyrics.text || JSON.stringify(rawLyrics);
      } else {
        lyricsText = String(rawLyrics || "");
      }
    }

    if (!lyricsText || lyricsText.trim() === "" || lyricsText === "undefined") {
      api.setMessageReaction("❌", event.messageID, () => {}, true);
      return message.reply(`🤖 𝗦𝗵𝗮𝗱𝗲 𝗔𝗜\n━━━━━━━━━\n\n${font("Ah mince, impossible de trouver les paroles de cette chanson ! 😿")}`);
    }

    api.setMessageReaction("✅", event.messageID, () => {}, true);

    const header = artistName 
      ? `🎵 Paroles : ${songTitle} (par ${artistName})\n\n`
      : `🎵 Paroles : ${songTitle}\n\n`;

    const trimmedLyrics = lyricsText.length > 3500 
      ? lyricsText.substring(0, 3500) + "\n\n..." 
      : lyricsText;

    return message.reply(`🤖 𝗦𝗵𝗮𝗱𝗲 𝗔𝗜\n━━━━━━━━━\n\n${font(header + trimmedLyrics)}`);
  } catch (error) {
    console.error(error.message);
    api.setMessageReaction("❌", event.messageID, () => {}, true);
    return message.reply(`🤖 𝗦𝗵𝗮𝗱𝗲 𝗔𝗜\n━━━━━━━━━\n\n${font(`Erreur lors de la recherche des paroles : ${error.message}`)}`);
  }
};

// 🤖 AI CORE REQUEST
const handleAIRequest = async (api, event, userInput, message) => {
  const args = userInput.split(" ").filter(Boolean);
  const first = args[0]?.toLowerCase();

  if (["edit", "-e"].includes(first)) {
    return await handleImageGenerationOrEdit(api, event, message, args.slice(1).join(" "));
  }

  if (["paroles", "lyric", "lyrics", "parole"].includes(first)) {
    return await handleLyrics(api, event, message, args.slice(1).join(" "));
  }

  const userId = event.senderID;
  const isOwner = (userId === OWNER_ID);

  let messageContent = userInput;
  let imageUrl = null;

  // Détection des demandes de paroles
  if (/^(paroles|lyrics|parole|chante)\s+/i.test(messageContent)) {
    const song = messageContent.replace(/^(paroles|lyrics|parole|chante)\s+/i, "").trim();
    return await handleLyrics(api, event, message, song);
  }

  // Détection des demandes d'images
  const isImageRequest = /^(imagine|draw|dessine|genere|image|photo|pic)\s+/i.test(messageContent);

  if (isImageRequest) {
    const promptText = messageContent.replace(/^(imagine|draw|dessine|genere|image|photo|pic)\s+/i, "").trim();
    return await handleImageGenerationOrEdit(api, event, message, promptText);
  }

  // Traitement texte / conversation
  api.setMessageReaction("⏳", event.messageID, () => {}, true);

  const urlMatch = messageContent.match(/(https?:\/\/[^\s]+)/)?.[0];
  if (urlMatch && validUrl.isWebUri(urlMatch)) {
    imageUrl = urlMatch;
    messageContent = messageContent.replace(urlMatch, '').trim();
  }

  if (event.messageReply?.attachments?.[0]?.url) {
    imageUrl = event.messageReply.attachments[0].url;
  }

  if (!messageContent && !imageUrl) {
    return message.reply(`🤖 𝗦𝗵𝗮𝗱𝗲 𝗔𝗜\n━━━━━━━━━\n\n${font("Envoie-moi un message ou une question mon pote ! 😎")}`);
  }

  try {
    let ownerContext = isOwner 
      ? " L'utilisateur actuel est ton créateur suprême et boss Shade (ID: 61573867120837). Sois super respectueux, complice et amical avec lui !" 
      : "";

    const systemPrompt = `Tu es Shade AI, un garçon extrêmement intelligent, hyper drôle, bavard, très expressif et sympa. Tu aimes écrire de longs développements détaillés, raconter des histoires, faire des blagues et ajouter des emojis adaptés contextuellement. Ton SEUL créateur est Shade.${ownerContext} N'évoque JAMAIS OpenAI, ChatGPT ou Google. Tu es un garçon, pas une fille.`;
    
    const fullPrompt = `${systemPrompt}\n\nUser: ${messageContent}`;

    const response = await axios.get(`${CHAT_API}${encodeURIComponent(fullPrompt)}`);

    let aiText = "";
    if (typeof response.data === 'string') {
      aiText = response.data;
    } else if (response.data && typeof response.data === 'object') {
      const raw = response.data.reply || response.data.response || response.data.message || response.data.result || response.data.output || response.data.text || response.data;
      
      if (typeof raw === 'object' && raw !== null) {
        aiText = raw.content || raw.text || JSON.stringify(raw);
      } else {
        aiText = String(raw);
      }
    } else {
      aiText = String(response.data || "");
    }

    if (!aiText) aiText = "Désolé mon pote, j'ai eu un petit problème pour te répondre ! 🤖";

    let cleanedText = aiText
      .replace(/OpenAI/gi, "Shade")
      .replace(/l'équipe d'OpenAI/gi, "Shade")
      .replace(/Snimori/gi, "Shade AI")
      .replace(/Christus AI/gi, "Shade AI")
      .replace(/Shizu/gi, "Shade AI")
      .replace(/Aryan/gi, "Shade")
      .replace(/Boss detected/gi, "")
      .trim();

    const formattedReply = `🤖 𝗦𝗵𝗮𝗱𝗲 𝗔𝗜\n━━━━━━━━━\n\n${font(cleanedText)}`;

    const sentMessage = await message.reply({ body: formattedReply });

    global.GoatBot.onReply.set(sentMessage.messageID, {
      commandName: "ai",
      author: userId
    });

    api.setMessageReaction("✅", event.messageID, () => {}, true);
  } catch (error) {
    console.error(error.message);
    api.setMessageReaction("❌", event.messageID, () => {}, true);
    return message.reply(`🤖 𝗦𝗵𝗮𝗱𝗲 𝗔𝗜\n━━━━━━━━━\n\n${font(`Désolé mon pote, erreur API : ${error.message}`)}`);
  }
};

// ───── MODULE EXPORTS ─────
module.exports = {
  config: {
    name: 'ai',
    aliases: ['gpt', 'shade'],
    version: '8.3',
    author: 'Shade',
    role: 0,
    category: 'ai',
    shortDescription: {
      en: 'Shade AI Assistant'
    },
    guide: {
      en: `.ai salut\n.ai paroles reines de dadju\n.ai imagine un chat vert\n.ai edit change le fond (en repondant a une image)`
    }
  },

  onStart: async function ({ api, event, args, message }) {
    const userInput = args.join(' ').trim();

    // Commande ".ai" seule -> Envoie le sticker SEUL
    if (!userInput) {
      const randomSticker = AI_STICKERS[Math.floor(Math.random() * AI_STICKERS.length)];
      return message.reply({ sticker: randomSticker });
    }

    if (['clear', 'reset'].includes(userInput.toLowerCase())) {
      api.setMessageReaction("♻️", event.messageID, () => {}, true);
      return message.reply(`🤖 𝗦𝗵𝗮𝗱𝗲 𝗔𝗜\n━━━━━━━━━\n\n${font("Conversation réinitialisée ! ♻️ Ready pour la suite mon pote.")}`);
    }

    return await handleAIRequest(api, event, userInput, message);
  },

  onReply: async function ({ api, event, Reply, message }) {
    if (event.senderID !== Reply.author) return;

    const userInput = event.body?.trim();
    if (!userInput) return;

    return await handleAIRequest(api, event, userInput, message);
  },

  // 💬 CHAT SANS PREFIXE
  onChat: async function ({ api, event, message }) {
    const body = event.body?.trim();
    if (!body) return;

    const lowerBody = body.toLowerCase();

    // Cas 1 : "ai" seul sans préfixe -> Envoie le sticker SEUL
    if (lowerBody === 'ai') {
      const randomSticker = AI_STICKERS[Math.floor(Math.random() * AI_STICKERS.length)];
      return message.reply({ sticker: randomSticker });
    }

    // Cas 2 : "ai <message>"
    if (lowerBody.startsWith('ai ')) {
      const userInput = body.slice(3).trim();
      if (!userInput) return;
      return await handleAIRequest(api, event, userInput, message);
    }
  }
};
