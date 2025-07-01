import { formatDistance } from "date-fns";
import { fr } from "date-fns/locale";

interface ChatMessageProps {
  question: string;
  response: string;
  timestamp: Date;
}

export default function ChatMessage({ question, response, timestamp }: ChatMessageProps) {
  // Format timestamp to something like "14:23" or "il y a 5 minutes"
  const formatTime = (date: Date) => {
    const now = new Date();
    // If it's today, show time
    if (date.toDateString() === now.toDateString()) {
      return date.toLocaleTimeString("fr-FR", {
        hour: "2-digit",
        minute: "2-digit",
      });
    }
    // Otherwise, show relative time
    return formatDistance(date, now, {
      addSuffix: true,
      locale: fr,
    });
  };

  const formattedTime = formatTime(timestamp);

  // Function to render markdown links
  const renderMarkdownLinks = (text: string): string => {
    // Basic markdown link regex
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    return text.replace(linkRegex, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  };

  return (
    <>
      {/* User message */}
      <div className="flex justify-end">
        <div className="chat-bubble bg-primary text-white rounded-xl p-4 shadow-card">
          <div className="flex items-start space-x-3">
            <div>
              <p>{question}</p>
              <p className="mt-1 text-primary-light text-xs text-right">{formattedTime}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Bot response */}
      <div className="flex justify-start">
        <div className="chat-bubble bg-white rounded-xl p-4 shadow-card border border-neutral-100">
          <div className="flex items-start space-x-3">
            <div className="w-6 h-6 bg-primary flex items-center justify-center rounded-full flex-shrink-0 mt-0.5">
              <span className="material-icons text-white text-sm">smart_toy</span>
            </div>
            <div>
              <div 
                className="text-neutral-800 whitespace-pre-wrap"
                dangerouslySetInnerHTML={{ __html: renderMarkdownLinks(response) }}
              />
              <p className="mt-1 text-neutral-400 text-xs">{formattedTime}</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}