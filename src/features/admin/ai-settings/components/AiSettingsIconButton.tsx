import type { ComponentType, SVGProps } from 'react';
import { Button } from '@/components/ui/Button';

type AiSettingsIconButtonProps = {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  label: string;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'ghost' | 'secondary' | 'destructive';
  onClick: () => void;
};

export function AiSettingsIconButton({
  icon: Icon,
  label,
  disabled,
  loading,
  variant = 'ghost',
  onClick,
}: AiSettingsIconButtonProps) {
  return (
    <Button
      size="sm"
      variant={variant}
      className="w-9 shrink-0 px-0"
      aria-label={label}
      title={label}
      disabled={disabled}
      loading={loading}
      onClick={onClick}
    >
      <Icon className="size-4" aria-hidden="true" />
    </Button>
  );
}
