import { UserStatus } from "@/lib/api";
import { DailyCounter } from "@/components/chat/DailyCounter";
import { AdminButton } from "./AdminButton";

interface MobileMenuProps {
  isOpen: boolean;
  onClose: () => void;
  email: string;
  userStatus?: UserStatus;
  isLoading?: boolean;
}

export default function MobileMenu({ 
  isOpen, 
  onClose, 
  email, 
  userStatus,
  isLoading = false 
}: MobileMenuProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 md:hidden">
      <div className="w-72 h-full bg-white shadow-xl flex flex-col">
        <div className="p-5 border-b border-neutral-100 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-primary flex items-center justify-center rounded-lg">
              <span className="material-icons text-white">school</span>
            </div>
            <h1 className="font-heading font-semibold text-lg text-neutral-800">LearnWorlds</h1>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-neutral-100">
            <span className="material-icons text-neutral-600">close</span>
          </button>
        </div>

        <div className="p-5 border-b border-neutral-100">
          {/* User profile */}
          <p className="text-sm font-medium text-neutral-700">Utilisateur connecté</p>
          <div className="flex items-center mt-2">
            <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center">
              <span className="material-icons text-sm">person</span>
            </div>
            <span className="ml-2 text-neutral-600 text-sm">{email}</span>
          </div>
        </div>

        {/* Daily counter */}
        <DailyCounter userStatus={userStatus} isLoading={isLoading} />

        <div className="flex-grow p-5">
          <div className="space-y-4">
            <button className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg bg-primary-light bg-opacity-10 text-primary hover:bg-opacity-20 transition-all">
              <span className="material-icons">forum</span>
              <span className="font-medium">Assistant Chat</span>
            </button>

            <button className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-neutral-600 hover:bg-neutral-100 transition-all">
              <span className="material-icons">help_outline</span>
              <span>Aide</span>
            </button>

            <button className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-neutral-600 hover:bg-neutral-100 transition-all">
              <span className="material-icons">settings</span>
              <span>Paramètres</span>
            </button>
          </div>
        </div>

        <div className="p-5 border-t border-neutral-100">
          <button className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-neutral-600 hover:bg-neutral-100 transition-all">
            <span className="material-icons">logout</span>
            <span>Se déconnecter</span>
          </button>
        </div>
      </div>
    </div>
  );
}