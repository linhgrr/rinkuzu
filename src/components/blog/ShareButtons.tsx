'use client';

import React, { useState } from 'react';
import { Twitter, Linkedin, Facebook, Link as LinkIcon, Check } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { toast } from 'sonner';

interface ShareButtonsProps {
  url: string;
  title: string;
}

export const ShareButtons = ({ url, title }: ShareButtonsProps) => {
  const [copied, setCopied] = useState(false);

  const shareLinks = [
    {
      name: 'Twitter',
      icon: <Twitter className="h-4 w-4" />,
      href: `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`,
      color: 'hover:bg-[#1DA1F2] hover:text-white',
    },
    {
      name: 'LinkedIn',
      icon: <Linkedin className="h-4 w-4" />,
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
      color: 'hover:bg-[#0077b5] hover:text-white',
    },
    {
      name: 'Facebook',
      icon: <Facebook className="h-4 w-4" />,
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
      color: 'hover:bg-[#4267B2] hover:text-white',
    },
  ];

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success('Link copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch (_err) {
      toast.error('Failed to copy link');
    }
  };

  return (
    <div className="flex items-center gap-2 py-6 border-y border-neutral-100 my-8">
      <span className="text-sm font-medium text-neutral-500 mr-2">Share this post:</span>
      <div className="flex gap-2">
        {shareLinks.map((link) => (
          <Button
            key={link.name}
            variant="outline"
            size="icon"
            className={`h-9 w-9 rounded-full ${link.color} transition-colors duration-200 border-neutral-200`}
            onClick={() => window.open(link.href, '_blank', 'noopener,noreferrer')}
            title={`Share on ${link.name}`}
          >
            {link.icon}
          </Button>
        ))}
        <Button
          variant="outline"
          size="icon"
          className="h-9 w-9 rounded-full hover:bg-neutral-100 transition-colors duration-200 border-neutral-200"
          onClick={copyToClipboard}
          title="Copy link"
        >
          {copied ? <Check className="h-4 w-4 text-green-500" /> : <LinkIcon className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
};
