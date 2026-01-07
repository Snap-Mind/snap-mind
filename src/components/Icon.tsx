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
  LuSettings,
  LuRotateCcw,
  LuCloud,
} from 'react-icons/lu';
import { MdOutlineCleaningServices } from "react-icons/md";

import OpenAI from '@lobehub/icons-static-svg/icons/openai.svg?react';
import AzureAI from '@lobehub/icons-static-svg/icons/azureai.svg?react';
import Anthropic from '@lobehub/icons-static-svg/icons/anthropic.svg?react';
import Gemini from '@lobehub/icons-static-svg/icons/gemini.svg?react';
import DeepSeek from '@lobehub/icons-static-svg/icons/deepseek.svg?react';
import Qwen from '@lobehub/icons-static-svg/icons/qwen.svg?react';
import Ollama from '@lobehub/icons-static-svg/icons/ollama.svg?react';

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
  | 'circle-x'
  | 'openai'
  | 'anthropic'
  | 'azure-openai'
  | 'google'
  | 'deepseek'
  | 'qwen'
  | 'ollama'
  | 'settings'
  | 'rotate-ccw'
  | 'cloud'
  | 'cleaning-services';

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
  onClick,
}: IconProps) {
  const renderIcon = () => {
    switch (icon) {
      case 'eye':
        return <LuEye className={svgClassName} color={color} size={size} />;
      case 'eye-off':
        return <LuEyeOff className={svgClassName} color={color} size={size} />;
      case 'trash-2':
        return <LuTrash2 className={svgClassName} color={color} size={size} />;
      case 'square-pen':
        return <LuSquarePen className={svgClassName} color={color} size={size} />;
      case 'plus':
        return <LuPlus className={svgClassName} color={color} size={size} />;
      case 'square':
        return <LuSquare className={svgClassName} color={color} size={size} />;
      case 'circle-check-big':
        return <LuCircleCheckBig className={svgClassName} color={color} size={size} />;
      case 'circle-x':
        return <LuCircleX className={svgClassName} color={color} size={size} />;
      case 'bot':
        return <LuBot className={svgClassName} color={color} size={size} />;
      case 'cog':
        return <LuCog className={svgClassName} color={color} size={size} />;
      case 'flame':
        return <LuFlame className={svgClassName} color={color} size={size} />;
      case 'square-dashed':
        return <LuSquareDashed className={svgClassName} color={color} size={size} />;
      case 'message-circle':
        return <LuMessageCircle className={svgClassName} color={color} size={size} />;
      case 'file-text':
        return <LuFileText className={svgClassName} color={color} size={size} />;
      case 'openai':
        return <OpenAI className={svgClassName} fill={color} width={size} height={size} />;
      case 'anthropic':
        return <Anthropic className={svgClassName} fill={color} width={size} height={size} />;
      case 'azure-openai':
        return <AzureAI className={svgClassName} fill={color} width={size} height={size} />;
      case 'google':
        return <Gemini className={svgClassName} fill={color} width={size} height={size} />;
      case 'deepseek':
        return <DeepSeek className={svgClassName} fill={color} width={size} height={size} />;
      case 'qwen':
        return <Qwen className={svgClassName} fill={color} width={size} height={size} />;
      case 'ollama':
        return <Ollama className={svgClassName} fill={color} width={size} height={size} />;
      case 'settings':
        return <LuSettings className={svgClassName} color={color} size={size} />;
      case 'rotate-ccw':
        return <LuRotateCcw className={svgClassName} color={color} size={size} />;
      case 'cloud':
        return <LuCloud className={svgClassName} color={color} size={size} />;
      case 'cleaning-services':
        return <MdOutlineCleaningServices className={svgClassName} color={color} size={size} />;
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
