const moment = require("moment-timezone");
const OWNER_ID = "61590788725790";
const fonts = require("../func/fonts.js");

module.exports = {
  config: {
    name: "accept",
    aliases: ["acp"],
    version: "3.7 clean",
    author: "Shade × Gemini ✨",
    role: 2,
    description: "Gestion des demandes d’amis Facebook",
    category: "owner",
    guide: {
      fr: "Répondez avec : add <num> | del <num> | add all | del all"
    }
  },
  onStart: async function ({ api, event, commandName }) {
    const { threadID, messageID, senderID } = event;
    if (senderID !== OWNER_ID) {
      const errAuth = fonts.christus("Cette commande est reservee a mon Owner.");
      return api.sendMessage(errAuth, threadID, messageID);
    }
    try {
      try { api.setMessageReaction("⏳", messageID, () => {}, true); } catch (e) {}
            
      const form = {
        av: api.getCurrentUserID(),
        fb_api_req_friendly_name: "FriendingCometFriendRequestsRootQueryRelayPreloader",
        fb_api_caller_class: "RelayModern",
        doc_id: "4499164963466303",
        variables: JSON.stringify({ input: { scale: 3 } })
      };
      const response = await api.httpPost("https://www.facebook.com/api/graphql/", form);
      const data = typeof response === "string" ? JSON.parse(response) : response;
      const listRequest = data?.data?.viewer?.friending_possibilities?.edges || [];
      if (!listRequest.length) {
        try { api.setMessageReaction("💔", messageID, () => {}, true); } catch (e) {}
        const noReq = fonts.christus("Aucune demande d'ami en attente");
        return api.sendMessage(noReq, threadID, messageID);
      }
      
      let rawMsg = fonts.bold("HORI ACCEPT LIST") + "\n\n";
      listRequest.forEach((u, i) => {
        const timeStr = u.time ? moment(u.time * 1000).tz("Africa/Kinshasa").format("DD/MM/YYYY HH:mm:ss") : "Inconnu";
        rawMsg += `${i + 1}. ${u.node?.name || "Utilisateur Facebook"}\n`;
        rawMsg += `ID: ${u.node?.id}\n`;
        rawMsg += `Date: ${timeStr}\n`;
        rawMsg += `https://www.facebook.com/${u.node?.id}\n`;
        rawMsg += "--------------------\n";
      });
      rawMsg += "\nPour interagir, repondez a ce message avec :\n• add <num>\n• del <num>\n• add all ou del all";
            
      const formattedMsg = fonts.christus(rawMsg);
      const sent = await api.sendMessage(formattedMsg, threadID, messageID);
            
      global.GoatBot?.onReply?.set(sent.messageID, {
        commandName,
        author: senderID,
        listRequest,
        messageID: sent.messageID,
        unsendTimeout: setTimeout(() => {
          try { api.unsendMessage(sent.messageID); } catch (e) {}
        }, 120000)
      });
      try { api.setMessageReaction("🪐", messageID, () => {}, true); } catch (e) {}
    } catch (e) {
      console.error(e);
      try { api.setMessageReaction("❌", messageID, () => {}, true); } catch (err) {}
      const errLoad = fonts.christus("Erreur lors du chargement des demandes");
      return api.sendMessage(errLoad, threadID, messageID);
    }
  },
  onReply: async function ({ api, event, Reply }) {
    const { threadID, messageID, senderID, body } = event;
    const { author, listRequest, messageID: replyMsgID } = Reply || {};
        
    if (senderID !== OWNER_ID || senderID !== author) return;
    const args = (body || "").trim().replace(/ +/g, " ").toLowerCase().split(" ");
    const action = args[0];
    if (action !== "add" && action !== "del") {
      const errAct = fonts.christus("Action invalide. Utilisez add ou del.");
      return api.sendMessage(errAct, threadID, messageID);
    }
    try {
      try { api.setMessageReaction("⏳", messageID, () => {}, true); } catch (e) {}
      clearTimeout(Reply?.unsendTimeout);
      if (!Array.isArray(listRequest) || listRequest.length === 0) {
        const errExp = fonts.christus("Liste expiree ou introuvable");
        return api.sendMessage(errExp, threadID, messageID);
      }
      
      const form = {
        av: api.getCurrentUserID(),
        fb_api_caller_class: "RelayModern",
        variables: {
          input: {
            source: "friends_tab",
            actor_id: api.getCurrentUserID(),
            client_mutation_id: Math.round(Math.random() * 19).toString()
          },
          scale: 3,
          refresh_num: 0
        }
      };
      if (action === "add") {
        form.fb_api_req_friendly_name = "FriendingCometFriendRequestConfirmMutation";
        form.doc_id = "3147613905362928";
      } else {
        form.fb_api_req_friendly_name = "FriendingCometFriendRequestDeleteMutation";
        form.doc_id = "4108254489275063";
      }
      let targetPositions = args.slice(1);
      if (args[1] === "all") {
        targetPositions = [];
        for (let i = 1; i <= listRequest.length; i++) targetPositions.push(i);
      }
      const success = [];
      const failed = [];
      const newTargetIDs = [];
      const promiseFriends = [];
      
      for (const stt of targetPositions) {
        const index = parseInt(stt, 10) - 1;
        const u = listRequest[index];
        if (!u || !u.node?.id) {
          failed.push(`Pos #${stt} Introuvable`);
          continue;
        }
        form.variables.input.friend_requester_id = u.node.id;
        const payload = {
          ...form,
          variables: JSON.stringify(form.variables)
        };
        newTargetIDs.push(u);
        promiseFriends.push(api.httpPost("https://www.facebook.com/api/graphql/", payload));
      }
      
      for (let i = 0; i < newTargetIDs.length; i++) {
        const name = newTargetIDs[i].node.name || newTargetIDs[i].node.id;
        try {
          const res = await promiseFriends[i];
          const resParsed = typeof res === "string" ? JSON.parse(res) : res;
          if (resParsed && resParsed.errors) {
            failed.push(`❌ ${name}`);
          } else {
            success.push(`✨ ${name}`);
          }
        } catch (e) {
          failed.push(`❌ ${name} (Reseau)`);
        }
      }
      try { api.setMessageReaction("✅", messageID, () => {}, true); } catch (e) {}
      try { api.unsendMessage(replyMsgID); } catch (e) {}
      
      let rawResult = fonts.bold("HORI ACCEPT RESULT") + "\n\n";
      if (success.length) {
        rawResult += `Action reussie pour ${success.length} personne(s) :\n${success.join("\n")}\n\n`;
      }
      if (failed.length) {
        rawResult += `Echecs rencontres (${failed.length}) :\n${failed.join("\n")}`;
      }
      
      const finalResultMsg = fonts.christus(rawResult);
      return api.sendMessage(finalResultMsg, threadID, messageID);
    } catch (globalErr) {
      console.error(globalErr);
      try { api.setMessageReaction("❌", messageID, () => {}, true); } catch (e) {}
      const errInt = fonts.christus("Une erreur interne est survenue lors du traitement");
      return api.sendMessage(errInt, threadID, messageID);
    }
  }
};
