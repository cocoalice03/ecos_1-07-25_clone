import { MessageCircle, User, HelpCircle } from "lucide-react";
import { UserStatus } from "@/lib/api";
import { DailyCounter } from "../chat/DailyCounter";
import { AdminButton } from "./AdminButton";

interface SidebarProps {
  email: string;
  userStatus?: UserStatus;
  isLoading?: boolean;
  className?: string;
}

export default function Sidebar({ 
  email, 
  userStatus, 
  isLoading = false,
  className = "" 
}: SidebarProps) {
  return (
    <div className={`md:w-72 bg-white shadow-card flex-shrink-0 flex-col ${className}`}>
      <div className="p-5 border-b border-neutral-100">
        <div className="flex items-center space-x-3">
          {/* Logo */}
          <div className="w-10 h-10 bg-primary flex items-center justify-center rounded-lg">
            <span className="material-icons text-white">school</span>
          </div>
          <div>
            <h1 className="font-heading font-semibold text-lg text-neutral-800">CEERRFbot</h1>
            <p className="text-sm text-neutral-500">Assistant de Cours</p>
          </div>
        </div>
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
        </div>
      </div>

      <div className="p-5 border-t border-neutral-100">
        <button className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-neutral-600 hover:bg-neutral-100 transition-all">
          <span className="material-icons">logout</span>
          <span>Se déconnecter</span>
        </button>

        <div className="pt-4 border-t border-neutral-200">
          <AdminButton email={email} />
        </div>
      </div>
    </div>
  );
}