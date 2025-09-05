import { Eye, EyeOff, Trash2, SquarePen, Plus, Square, CircleCheckBig, CircleX } from 'lucide-react';

type IconType = 'eye' | 'eye-off' | 'trash-2' | 'square-pen' | 'plus' | 'square' | 'circle-check-big' | 'circle-x';

interface IconProps {
  className?: string;
  svgClassName?: string;
  icon: IconType;
  color?: string;
  size?: number;
  strokeWidth?: number;
  absoluteStrokeWidth?: boolean;
  onClick?: () => void;
}

function Icon({
  className,
  svgClassName,
  icon,
  color = 'currentColor',
  size = 18,
  strokeWidth = 2,
  absoluteStrokeWidth = false,
  onClick,
}: IconProps) {
  const renderIcon = () => {
    switch (icon) {
      case 'eye':
        return (
          <Eye
            className={svgClassName}
            color={color}
            size={size}
            strokeWidth={strokeWidth}
            absoluteStrokeWidth={absoluteStrokeWidth}
          />
        );
      case 'eye-off':
        return (
          <EyeOff
            className={svgClassName}
            color={color}
            size={size}
            strokeWidth={strokeWidth}
            absoluteStrokeWidth={absoluteStrokeWidth}
          />
        );
      case 'trash-2':
        return (
          <Trash2
            className={svgClassName}
            color={color}
            size={size}
            strokeWidth={strokeWidth}
            absoluteStrokeWidth={absoluteStrokeWidth}
          />
        );
      case 'square-pen':
        return (
          <SquarePen
            className={svgClassName}
            color={color}
            size={size}
            strokeWidth={strokeWidth}
            absoluteStrokeWidth={absoluteStrokeWidth}
          />
        );
      case 'plus':
        return (
          <Plus
            className={svgClassName}
            color={color}
            size={size}
            strokeWidth={strokeWidth}
            absoluteStrokeWidth={absoluteStrokeWidth}
          />
        );
      case 'square':
        return (
          <Square
            className={svgClassName}
            color={color}
            size={size}
            strokeWidth={strokeWidth}
            absoluteStrokeWidth={absoluteStrokeWidth}
          />
        );
      case 'circle-check-big':
        return (
          <CircleCheckBig
            className={svgClassName}
            color={color}
            size={size}
            strokeWidth={strokeWidth}
            absoluteStrokeWidth={absoluteStrokeWidth}
          />
        );
      case 'circle-x':
        return (
          <CircleX
            className={svgClassName}
            color={color}
            size={size}
            strokeWidth={strokeWidth}
            absoluteStrokeWidth={absoluteStrokeWidth}
          />
        );
      default:
        return null;
    }
  };
  return (
    <span className={className} onClick={onClick}>
      {renderIcon()}
    </span>
  );
}

export default Icon;
