import { useState, FormEvent } from "react";

interface ChatInputProps {
  onSendQuestion: (question: string) => void;
  isDisabled?: boolean;
}

export default function ChatInput({ onSendQuestion, isDisabled = false }: ChatInputProps) {
  const [question, setQuestion] = useState("");

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (question.trim() && !isDisabled) {
      onSendQuestion(question);
      setQuestion("");
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-card p-2">
      <form className="flex items-center space-x-2" onSubmit={handleSubmit}>
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Posez votre question sur le contenu du cours..."
          className="flex-grow px-4 py-3 text-neutral-700 bg-transparent border-none focus:outline-none"
          disabled={isDisabled}
        />
        <button
          type="submit"
          disabled={!question.trim() || isDisabled}
          className="p-2 rounded-full bg-primary text-white hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span className="material-icons">send</span>
        </button>
      </form>
    </div>
  );
}
