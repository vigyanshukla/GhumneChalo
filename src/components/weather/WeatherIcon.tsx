'use client';

import React from 'react';
import {
  Sun,
  CloudSun,
  Cloud,
  CloudFog,
  CloudDrizzle,
  CloudRain,
  CloudSnow,
  CloudLightning,
  HelpCircle,
} from 'lucide-react';
import { WeatherConditionCategory } from '@/lib/weather/types';

interface WeatherIconProps {
  category?: WeatherConditionCategory;
  className?: string;
  size?: number;
}

export function WeatherIcon({ category = 'unknown', className = 'w-5 h-5', size }: WeatherIconProps) {
  switch (category) {
    case 'clear':
      return <Sun className={`${className} text-amber-500`} size={size} />;
    case 'partly_cloudy':
      return <CloudSun className={`${className} text-amber-400 dark:text-amber-300`} size={size} />;
    case 'cloudy':
      return <Cloud className={`${className} text-zinc-400 dark:text-zinc-300`} size={size} />;
    case 'fog':
      return <CloudFog className={`${className} text-slate-400 dark:text-slate-300`} size={size} />;
    case 'drizzle':
      return <CloudDrizzle className={`${className} text-cyan-500 dark:text-cyan-400`} size={size} />;
    case 'rain':
      return <CloudRain className={`${className} text-blue-500 dark:text-blue-400`} size={size} />;
    case 'snow':
      return <CloudSnow className={`${className} text-sky-300 dark:text-sky-200`} size={size} />;
    case 'thunderstorm':
      return <CloudLightning className={`${className} text-violet-500 dark:text-violet-400`} size={size} />;
    default:
      return <HelpCircle className={`${className} text-zinc-400`} size={size} />;
  }
}
