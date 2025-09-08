
import { useState, useEffect } from "react";
import { Settings } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AdminButtonProps {
  email: string;
}

export function AdminButton({ email }: AdminButtonProps) {
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    async function checkAdminStatus() {
      try {
        const response = await fetch(`/api/auth/check-admin?email=${encodeURIComponent(email)}`);
        if (response.ok) {
          const data = await response.json();
          setIsAdmin(data.isAdmin);
        }
      } catch (error) {
        console.error('Error checking admin status:', error);
        setIsAdmin(false);
      } finally {
        setLoading(false);
      }
    }

    if (email) {
      checkAdminStatus();
    }
  }, [email]);

  if (loading) {
    return null; // Don't show button while checking admin status
  }

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
