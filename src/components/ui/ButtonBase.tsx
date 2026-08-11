import type { ButtonHTMLAttributes } from 'react';

export type ButtonBaseProps = ButtonHTMLAttributes<HTMLButtonElement>;

/**
 * Styling-neutral button primitive for controls that own their visual treatment.
 * Defaults to type="button" so using it inside a form never submits accidentally.
 */
export function ButtonBase(props: ButtonBaseProps) {
  return <button type="button" {...props} />;
}
