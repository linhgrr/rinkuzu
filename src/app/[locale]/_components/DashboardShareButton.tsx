'use client';

import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { HiOutlineShare } from '@/components/icons';

interface DashboardShareButtonProps {
  title: string;
  successMessage: string;
  shareText: string;
}

export function DashboardShareButton({
  title,
  successMessage,
  shareText,
}: DashboardShareButtonProps) {
  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title,
          text: shareText,
          url: window.location.origin,
        });
        return;
      } catch (error) {
        console.error(error);
      }
    }

    await navigator.clipboard.writeText(shareText);
    toast.success(successMessage);
  };

  return (
    <Button
      variant="outline"
      onClick={handleShare}
      className="hidden min-h-[44px] items-center gap-2 rounded-full border-gray-300 font-medium transition-all duration-300 hover:bg-gray-100 sm:flex"
    >
      {successMessage} <HiOutlineShare className="h-4 w-4" />
    </Button>
  );
}
