'use client';

import type { ChangeEvent } from 'react';
import { HiOutlineSearch } from 'react-icons/hi';

import { Input } from '@/components/ui/Input';

interface AdminSearchInputProps {
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
  onEnter?: () => void;
  className?: string;
}

export function AdminSearchInput({
  value,
  placeholder,
  onChange,
  onEnter,
  className,
}: AdminSearchInputProps) {
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange(event.target.value);
  };

  return (
    <Input
      type="text"
      aria-label={placeholder}
      placeholder={placeholder}
      value={value}
      onChange={handleChange}
      onKeyDown={(event) => {
        if (event.nativeEvent.isComposing || event.key !== 'Enter') return;
        event.preventDefault();
        if (onEnter) {
          onEnter();
          return;
        }
        event.currentTarget.form?.requestSubmit();
      }}
      icon={<HiOutlineSearch className="size-5" aria-hidden="true" />}
      className={className}
    />
  );
}
