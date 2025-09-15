import {
  LuBot,
  LuEye,
  LuEyeOff,
  LuTrash2,
  LuSquarePen,
  LuPlus,
  LuSquare,
  LuCircleCheckBig,
  LuCircleX,
  LuCog,
  LuFlame,
  LuSquareDashed,
  LuMessageCircle,
  LuFileText,
} from 'react-icons/lu';

type IconType =
  | 'bot'
  | 'cog'
  | 'eye'
  | 'eye-off'
  | 'flame'
  | 'file-text'
  | 'trash-2'
  | 'square-pen'
  | 'square-dashed'
  | 'message-circle'
  | 'plus'
  | 'square'
  | 'circle-check-big'
  | 'circle-x';

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
          <LuEye className={svgClassName} color={color} size={size} />
        );
      case 'eye-off':
        return (
          <LuEyeOff className={svgClassName} color={color} size={size} />
        );
      case 'trash-2':
        return (
          <LuTrash2 className={svgClassName} color={color} size={size} />
        );
      case 'square-pen':
        return (
          <LuSquarePen className={svgClassName} color={color} size={size} />
        );
      case 'plus':
        return (
          <LuPlus className={svgClassName} color={color} size={size} />
        );
      case 'square':
        return (
          <LuSquare className={svgClassName} color={color} size={size} />
        );
      case 'circle-check-big':
        return (
          <LuCircleCheckBig className={svgClassName} color={color} size={size} />
        );
      case 'circle-x':
        return (
          <LuCircleX className={svgClassName} color={color} size={size} />
        );
      case 'bot':
        return (
          <LuBot className={svgClassName} color={color} size={size} />
        );
      case 'cog':
        return (
          <LuCog className={svgClassName} color={color} size={size} />
        );
      case 'flame':
        return (
          <LuFlame className={svgClassName} color={color} size={size} />
        );
      case 'square-dashed':
        return (
          <LuSquareDashed className={svgClassName} color={color} size={size} />
        );
      case 'message-circle':
        return (
          <LuMessageCircle className={svgClassName} color={color} size={size} />
        );
      case 'file-text':
        return (
          <LuFileText className={svgClassName} color={color} size={size} />
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
