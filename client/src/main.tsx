import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Custom element protection is now handled by ultra-early HTML script
// This ensures protection is active before ANY external scripts can run

// Log diagnostic information if protection system is available
if (typeof window !== 'undefined' && window.__ECOS_ELEMENT_PROTECTION__) {
  console.log('🔍 Protection system status:', window.__ECOS_ELEMENT_PROTECTION__.metrics());
  console.log('🔍 Registered elements:', window.__ECOS_ELEMENT_PROTECTION__.registeredElements());
}

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
