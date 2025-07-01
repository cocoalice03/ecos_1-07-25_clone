interface ErrorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ErrorModal({ isOpen, onClose }: ErrorModalProps) {
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
      <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
        <div className="flex items-center justify-center mb-4">
          <div className="w-16 h-16 bg-accent bg-opacity-10 rounded-full flex items-center justify-center">
            <span className="material-icons text-accent text-3xl">error_outline</span>
          </div>
        </div>
        <h3 className="text-center font-heading font-semibold text-xl mb-2">Service temporairement indisponible</h3>
        <p className="text-center text-neutral-600 mb-6">
          Nous rencontrons actuellement des difficultés techniques. Veuillez réessayer dans quelques instants.
        </p>
        <button 
          onClick={onClose}
          className="w-full py-3 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
        >
          Fermer
        </button>
      </div>
    </div>
  );
}
