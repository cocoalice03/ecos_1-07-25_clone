
import { Settings } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AdminButtonProps {
  email: string;
}

const ADMIN_EMAILS = ['cherubindavid@gmail.com', 'colombemadoungou@gmail.com'];

export function AdminButton({ email }: AdminButtonProps) {
  const isAdmin = ADMIN_EMAILS.includes(email.toLowerCase());

  if (!isAdmin) {
    return null;
  }

  const handleAdminClick = () => {
    window.location.href = `/admin?email=${encodeURIComponent(email)}`;
  };

  return (
    <Button
      onClick={handleAdminClick}
      variant="outline"
      className="flex items-center gap-2 text-sm"
    >
      <Settings className="h-4 w-4" />
      Administration
    </Button>
  );
}
