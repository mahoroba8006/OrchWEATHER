import type { ReactNode } from 'react';
import { m, type HTMLMotionProps } from 'motion/react';
import { pressScale, springs } from '../../lib/motion';
import './ui.css';

type Variant = 'primary' | 'secondary' | 'ghost';

type ButtonProps = Omit<HTMLMotionProps<'button'>, 'children'> & {
  variant?: Variant;
  children: ReactNode;
};

/** 押すと沈み、離すと弾むボタン */
export function Button({ variant = 'primary', className, type = 'button', disabled, children, ...rest }: ButtonProps) {
  return (
    <m.button
      type={type}
      disabled={disabled}
      className={['ui-btn', `ui-btn--${variant}`, className].filter(Boolean).join(' ')}
      whileTap={disabled ? undefined : { scale: pressScale }}
      transition={springs.press}
      {...rest}
    >
      {children}
    </m.button>
  );
}
