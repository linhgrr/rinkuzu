'use client';

import React, { useState } from 'react';
import { Twitter, Linkedin, Facebook, Link as LinkIcon, Check } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { toast } from 'sonner';
import { copyToClipboard } from '@/lib/clipboard';

type ShareNetwork = 'Twitter' | 'LinkedIn' | 'Facebook';

/** Localized copy, resolved by the server page from the `blog` messages (RIN-1387). */
export interface ShareLabels {
  label: string;
  copyLink: string;
  copied: string;
  copyFailed: string;
  shareOn: Record<ShareNetwork, string>;
}

interface ShareButtonsProps {
  url: string;
  title: string;
  labels: ShareLabels;
}

export const ShareButtons = ({ url, title, labels }: ShareButtonsProps) => {
  const [copied, setCopied] = useState(false);

  const shareLinks: Array<{
    name: ShareNetwork;
    icon: React.ReactNode;
    href: string;
    color: string;
  }> = [
    {
      name: 'Twitter',
      icon: <Twitter className="size-4" />,
      href: `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`,
      color: 'hover:bg-[#1DA1F2] hover:text-white',
    },
    {
      name: 'LinkedIn',
      icon: <Linkedin className="size-4" />,
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
      color: 'hover:bg-[#0077b5] hover:text-white',
    },
    {
      name: 'Facebook',
      icon: <Facebook className="size-4" />,
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
      color: 'hover:bg-[#4267B2] hover:text-white',
    },
  ];

  const handleCopy = async () => {
    const ok = await copyToClipboard(url);
    if (ok) {
      setCopied(true);
      toast.success(labels.copied);
      setTimeout(() => setCopied(false), 2000);
    } else {
      toast.error(labels.copyFailed);
    }
  };

  return (
    <div className="flex items-center gap-2 py-6 border-y border-neutral-100 my-8">
      <span className="text-sm font-medium text-neutral-500 mr-2">{labels.label}</span>
      <div className="flex gap-2">
        {shareLinks.map((link) => (
          <Button
            key={link.name}
            variant="outline"
            size="icon"
            className={`size-11 rounded-full ${link.color} transition-colors duration-200 border-neutral-200`}
            onClick={() => window.open(link.href, '_blank', 'noopener,noreferrer')}
            title={labels.shareOn[link.name]}
          >
            {link.icon}
          </Button>
        ))}
        <Button
          variant="outline"
          size="icon"
          className="size-11 rounded-full hover:bg-neutral-100 transition-colors duration-200 border-neutral-200"
          onClick={handleCopy}
          title={labels.copyLink}
        >
          {copied ? <Check className="size-4 text-green-500" /> : <LinkIcon className="size-4" />}
        </Button>
      </div>
    </div>
  );
};
