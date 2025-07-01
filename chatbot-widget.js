(function() {
  // Configuration du widget chatbot
  const CHATBOT_BASE_URL = window.location.origin;
  
  // Fonction pour obtenir l'email de l'utilisateur LearnWorlds
  function getUserEmail() {
    // LearnWorlds expose l'email dans différents endroits selon le contexte
    if (window.LW && window.LW.user && window.LW.user.email) {
      return window.LW.user.email;
    }
    
    // Alternative: chercher dans les métadonnées de la page
    const emailMeta = document.querySelector('meta[name="user-email"]');
    if (emailMeta) {
      return emailMeta.getAttribute('content');
    }
    
    // Alternative: chercher dans les données utilisateur LearnWorlds
    if (window.userData && window.userData.email) {
      return window.userData.email;
    }
    
    return null;
  }
  
  // Créer le bouton du chatbot
  function createChatbotButton() {
    const button = document.createElement('div');
    button.id = 'chatbot-widget';
    button.innerHTML = `
      <div style="
        position: fixed;
        bottom: 20px;
        right: 20px;
        width: 60px;
        height: 60px;
        background: #3B82F6;
        border-radius: 50%;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 9999;
        transition: all 0.3s ease;
      " onmouseover="this.style.transform='scale(1.1)'" onmouseout="this.style.transform='scale(1)'">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
          <path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/>
        </svg>
      </div>
    `;
    
    button.onclick = openChatbot;
    document.body.appendChild(button);
  }
  
  // Ouvrir le chatbot dans une nouvelle fenêtre
  function openChatbot() {
    const email = getUserEmail();
    
    if (!email) {
      alert('Veuillez vous connecter pour accéder au chatbot.');
      return;
    }
    
    const chatbotUrl = `${CHATBOT_BASE_URL}/${encodeURIComponent(email)}`;
    
    // Ouvrir dans une nouvelle fenêtre avec taille optimisée
    window.open(
      chatbotUrl,
      'chatbot',
      'width=400,height=600,scrollbars=yes,resizable=yes,toolbar=no,menubar=no,location=no,status=no'
    );
  }
  
  // Initialiser le widget quand la page est chargée
  function init() {
    // Attendre que LearnWorlds soit complètement chargé
    setTimeout(() => {
      createChatbotButton();
    }, 2000);
  }
  
  // Démarrer l'initialisation
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();