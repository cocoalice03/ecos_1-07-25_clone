// Script d'intégration chatbot pour LearnWorlds
// À ajouter dans la section "Code JavaScript personnalisé" dans les paramètres du site

(function() {
  // Configuration - URL de votre application Replit
  const API_BASE_URL = 'https://' + window.location.hostname + (window.location.port ? ':' + window.location.port : '');
  
  // Variables globales
  let userEmail = '';
  let chatbotReady = false;
  let chatObserver = null;
  
  // Fonction principale d'initialisation
  function initChatbotIntegration() {
    console.log('Initialisation de l\'intégration du chatbot...');
    
    // Obtenir l'email de l'utilisateur
    getUserEmail().then(email => {
      if (!email) {
        console.error("Impossible d'identifier l'utilisateur");
        return;
      }
      
      userEmail = email;
      console.log(`Utilisateur identifié: ${userEmail}`);
      
      // Créer une session via notre API
      return fetch(`${API_BASE_URL}/api/webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email: userEmail })
      });
    })
    .then(response => {
      if (!response || !response.ok) {
        throw new Error('Échec de la création de session');
      }
      
      console.log('Session créée avec succès');
      
      // Observer les changements dans le DOM pour détecter le chatbot LearnWorlds
      setupChatObserver();
    })
    .catch(error => {
      console.error('Erreur d\'initialisation:', error);
    });
  }
  
  // Obtenir l'email de l'utilisateur depuis LearnWorlds
  async function getUserEmail() {
    // Méthode 1: Accéder à l'objet global LW de LearnWorlds
    if (typeof LW !== 'undefined' && LW.user && LW.user.email) {
      return LW.user.email;
    }
    
    // Méthode 2: Accéder aux variables partagées de LearnWorlds
    if (typeof lwSharedVariables !== 'undefined' && lwSharedVariables.user && lwSharedVariables.user.email) {
      return lwSharedVariables.user.email;
    }
    
    // Méthode 3: Extraire depuis la page (peut nécessiter d'être adapté)
    const userDataElement = document.querySelector('[data-user-email]');
    if (userDataElement && userDataElement.getAttribute('data-user-email')) {
      return userDataElement.getAttribute('data-user-email');
    }
    
    // Fallback pour les tests - NE PAS UTILISER EN PRODUCTION
    // return 'test@example.com';
    
    // Si nous n'avons pas pu obtenir l'email
    console.error("Impossible d'obtenir l'email de l'utilisateur");
    return null;
  }
  
  // Observer le DOM pour détecter quand le chatbot LearnWorlds est chargé
  function setupChatObserver() {
    if (chatObserver) {
      chatObserver.disconnect();
    }
    
    chatObserver = new MutationObserver(function(mutations) {
      mutations.forEach(function(mutation) {
        if (mutation.addedNodes && mutation.addedNodes.length > 0) {
          // Rechercher le chatbot dans les nouveaux nœuds
          for (let i = 0; i < mutation.addedNodes.length; i++) {
            const node = mutation.addedNodes[i];
            if (node.nodeType === 1) { // 1 = ELEMENT_NODE
              const chatContainer = node.querySelector('.lwc-chat-container, .chat-container');
              if (chatContainer) {
                console.log('Chatbot LearnWorlds détecté!');
                hookIntoChatbot(chatContainer);
                break;
              } else if (node.classList && (node.classList.contains('lwc-chat-container') || node.classList.contains('chat-container'))) {
                console.log('Chatbot LearnWorlds détecté directement!');
                hookIntoChatbot(node);
                break;
              }
            }
          }
        }
      });
    });
    
    chatObserver.observe(document.body, {
      childList: true,
      subtree: true
    });
    
    console.log('Observateur de chatbot configuré');
    
    // Vérifier immédiatement si le chatbot est déjà présent dans le DOM
    const existingChatbot = document.querySelector('.lwc-chat-container, .chat-container');
    if (existingChatbot) {
      console.log('Chatbot LearnWorlds déjà présent dans le DOM');
      hookIntoChatbot(existingChatbot);
    }
  }
  
  // Se connecter au chatbot LearnWorlds
  function hookIntoChatbot(chatContainer) {
    if (chatbotReady) {
      return; // Éviter les doubles initialisations
    }
    
    // Trouver les éléments d'interface du chatbot
    const inputField = chatContainer.querySelector('input[type="text"], textarea, input.lwc-chat-input');
    const sendButton = chatContainer.querySelector('button.lwc-chat-send, button.send, button.envoyer, button[type="submit"]');
    
    // Si nous ne trouvons pas les éléments, essayer une approche plus générique
    if (!inputField || !sendButton) {
      console.log('Éléments du chatbot non trouvés, utilisation de sélecteurs génériques');
      const inputFields = chatContainer.querySelectorAll('input, textarea');
      const buttons = chatContainer.querySelectorAll('button');
      
      // Prendre le dernier champ de saisie et le dernier bouton trouvés
      if (inputFields.length > 0) {
        inputField = inputFields[inputFields.length - 1];
      }
      
      if (buttons.length > 0) {
        sendButton = buttons[buttons.length - 1];
      }
    }
    
    if (!inputField || !sendButton) {
      console.error('Impossible de trouver les éléments d\'interface du chatbot');
      return;
    }
    
    console.log('Éléments du chatbot trouvés:', inputField, sendButton);
    
    // Remplacer le gestionnaire d'événements du formulaire
    const chatForm = chatContainer.querySelector('form');
    if (chatForm) {
      chatForm.addEventListener('submit', function(e) {
        e.preventDefault();
        e.stopPropagation();
        
        handleChatQuestion(inputField.value);
        return false;
      }, true);
      
      console.log('Gestionnaire de formulaire remplacé');
    }
    
    // Remplacer le gestionnaire de clic du bouton
    sendButton.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      
      handleChatQuestion(inputField.value);
      return false;
    }, true);
    
    console.log('Gestionnaire de bouton remplacé');
    
    // Indiquer que le chatbot est prêt
    chatbotReady = true;
    console.log('Intégration du chatbot terminée avec succès');
  }
  
  // Gérer une question posée au chatbot
  function handleChatQuestion(question) {
    // Vérifier que nous avons une question et un email
    question = question.trim();
    if (!question || !userEmail) {
      return;
    }
    
    console.log(`Question posée: "${question}"`);
    
    // Envoyer la question à notre API
    fetch(`${API_BASE_URL}/api/learnworlds/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: userEmail,
        query: question
      })
    })
    .then(response => response.json())
    .then(data => {
      if (data.status === 'error') {
        console.error('Erreur de l\'API:', data.message);
        
        // Injecter la réponse d'erreur dans le chat
        injectResponse(data.message || 'Désolé, une erreur est survenue. Veuillez réessayer plus tard.');
      } else {
        console.log('Réponse reçue:', data);
        
        // Injecter la réponse dans le chat
        injectResponse(data.response);
      }
    })
    .catch(error => {
      console.error('Erreur lors de l\'envoi de la question:', error);
      injectResponse('Désolé, une erreur de connexion est survenue. Veuillez vérifier votre connexion internet et réessayer.');
    });
  }
  
  // Injecter une réponse dans l'interface du chatbot
  function injectResponse(responseText) {
    // Cette fonction doit être adaptée en fonction de la structure de LearnWorlds
    // Malheureusement, sans connaître exactement leur implémentation, nous devons essayer plusieurs méthodes
    
    // Méthode 1: Trouver la fonction de rappel existante et l'appeler
    if (typeof window.lwChatCallback === 'function') {
      window.lwChatCallback(responseText);
      return;
    }
    
    // Méthode 2: Déclencher un événement personnalisé que LearnWorlds pourrait écouter
    const chatEvent = new CustomEvent('lwChatResponse', { 
      detail: { response: responseText } 
    });
    document.dispatchEvent(chatEvent);
    
    // Méthode 3: Injecter directement dans le DOM (risqué car dépend de la structure)
    try {
      const chatContainer = document.querySelector('.lwc-chat-container, .chat-container');
      if (!chatContainer) return;
      
      const messagesContainer = chatContainer.querySelector('.lwc-chat-messages, .chat-messages, .messages');
      if (!messagesContainer) return;
      
      // Créer un élément de message
      const messageElement = document.createElement('div');
      messageElement.classList.add('lwc-chat-message', 'lwc-chat-message-bot', 'bot-message');
      messageElement.innerHTML = `<div class="lwc-chat-message-content">${responseText}</div>`;
      
      // Ajouter au conteneur de messages
      messagesContainer.appendChild(messageElement);
      
      // Faire défiler vers le bas
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    } catch (e) {
      console.error('Échec de l\'injection de réponse dans le DOM:', e);
    }
  }
  
  // Démarrer l'initialisation lorsque le DOM est chargé
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initChatbotIntegration);
  } else {
    // Le DOM est déjà chargé
    initChatbotIntegration();
  }
})();