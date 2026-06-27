(function(){
  'use strict';
  if (window.__AET_AI_CHAT_LOADED__) return;
  window.__AET_AI_CHAT_LOADED__ = true;

  const api = {
    available: false,
    version: 'stub-1.0.0',
    open(){
      const msg = "Module AET AI Chat non fourni dans le lot source. Un fichier stub a été installé pour éviter l'erreur 404.";
      if (typeof window.toast === 'function') {
        window.toast(msg, 'info');
      } else {
        console.info(msg);
        alert(msg);
      }
    }
  };

  window.AETAIChat = api;
  window.openAETAIChat = api.open;

  console.info('[AET] aet-ai-chat.js chargé en mode stub.');
})();
