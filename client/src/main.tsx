import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { preventCustomElementConflicts, logCustomElements, detectCustomElementSources } from "./utils/customElementPrevention";

// Initialize custom element conflict prevention IMMEDIATELY
// This must happen before any other scripts that might define custom elements
preventCustomElementConflicts();

// Log what's already defined
console.log('🔍 Pre-existing custom elements:', {
  'vite-error-overlay': !!window.customElements.get('vite-error-overlay'),
  'autosize-textarea': !!window.customElements.get('autosize-textarea'),
  'replit-custom-element': !!window.customElements.get('replit-custom-element')
});

// Log diagnostic information
setTimeout(() => {
  logCustomElements();
  detectCustomElementSources();
}, 1000);

// URL params to extract email for authentication
let email = null;

// Try to get email from URL in different ways
// Method 1: Standard URL params
const params = new URLSearchParams(window.location.search);
email = params.get('email');

// Method 2: Check if email is part of the path
if (!email) {
  const pathParts = window.location.pathname.split('/');
  for (const part of pathParts) {
    if (part.includes('@')) {
      email = part;
      break;
    }
  }
}

// Method 3: Check if entire hostname/path contains email
if (!email) {
  const fullUrl = window.location.href;
  const emailMatch = fullUrl.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/gi);
  if (emailMatch && emailMatch.length > 0) {
    email = emailMatch[0];
  }
}

console.log("Detected email:", email);

createRoot(document.getElementById("root")!).render(
  <App initialEmail={email} />
);
