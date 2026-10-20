import MindLogo from '@/assets/mind.svg?react';
import MindBackLogo from '@/assets/mind-back.svg?react';

interface LogoSvgProps {
  className?: string;
  variant?: 'default' | 'back';
}

function LogoSvg({ className = 'w-8 h-8', variant = 'default' }: LogoSvgProps) {
  const Logo = variant === 'back' ? MindBackLogo : MindLogo;
  const ariaLabel = variant === 'back' ? 'Back to chat' : 'SnapMind Logo';

  return <Logo className={`${className} text-foreground`} aria-label={ariaLabel} />;
}

export default LogoSvg;
