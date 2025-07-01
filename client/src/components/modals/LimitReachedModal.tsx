interface LimitReachedModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function LimitReachedModal({ isOpen, onClose }: LimitReachedModalProps) {
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
      <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
        <div className="flex items-center justify-center mb-4">
          <div className="w-16 h-16 bg-primary bg-opacity-10 rounded-full flex items-center justify-center">
            <span className="material-icons text-primary text-3xl">hourglass_empty</span>
          </div>
        </div>
        <h3 className="text-center font-heading font-semibold text-xl mb-2">Limite quotidienne atteinte</h3>
        <p className="text-center text-neutral-600 mb-6">
          Vous avez utilisé vos 20 questions quotidiennes. Votre compteur sera réinitialisé à minuit (UTC+2).
        </p>
        <button 
          onClick={onClose}
          className="w-full py-3 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
        >
          J'ai compris
        </button>
      </div>
    </div>
  );
}
