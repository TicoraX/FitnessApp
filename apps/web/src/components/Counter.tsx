import { motion, useSpring, useTransform, type MotionValue } from 'motion/react';
import { useEffect, type CSSProperties } from 'react';
import './Counter.css';

interface NumberProps {
  mv: MotionValue<number>;
  number: number;
  height: number;
  isCurrent: boolean;
}

function NumberDigit({ mv, number, height, isCurrent }: NumberProps) {
  const y = useTransform(mv, (latest) => (number - latest) * height);

  if (!isCurrent) return null;

  return (
    <motion.span
      className="counter-number"
      data-active={true}
      style={{ y }}
    >
      {number}
    </motion.span>
  );
}

function normalizeNearInteger(num: number): number {
  const nearest = Math.round(num);
  const tolerance = 1e-9 * Math.max(1, Math.abs(num));
  return Math.abs(num - nearest) < tolerance ? nearest : num;
}

function getDigitForPlace(value: number, place: number): number {
  const scaled = Math.floor(normalizeNearInteger(value / place));
  return Math.abs(scaled % 10);
}

interface DigitProps {
  place: number | string;
  value: number;
  height: number;
  digitStyle?: CSSProperties;
  stiffness?: number;
  damping?: number;
}

function Digit({ place, value, height, digitStyle, stiffness = 40, damping = 20 }: DigitProps) {
  const isDecimal = place === '.';
  const numericPlace = typeof place === 'number' ? place : 1;
  const targetDigit = isDecimal ? 0 : getDigitForPlace(value, numericPlace);
  const animatedValue = useSpring(targetDigit, { mass: 1, stiffness, damping });

  useEffect(() => {
    if (!isDecimal) {
      animatedValue.set(targetDigit);
    }
  }, [animatedValue, targetDigit, isDecimal]);

  if (isDecimal) {
    return (
      <span className="counter-digit" style={{ height, ...digitStyle, width: 'fit-content' }}>
        .
      </span>
    );
  }

  return (
    <span className="counter-digit" style={{ height, ...digitStyle }}>
      {Array.from({ length: 10 }, (_, i) => (
        <NumberDigit key={i} mv={animatedValue} number={i} height={height} isCurrent={i === targetDigit} />
      ))}
    </span>
  );
}

export interface CounterProps {
  value: number;
  fontSize?: number;
  padding?: number;
  places?: (number | string)[];
  gap?: number;
  borderRadius?: number;
  horizontalPadding?: number;
  textColor?: string;
  fontWeight?: string | number;
  containerStyle?: CSSProperties;
  counterStyle?: CSSProperties;
  digitStyle?: CSSProperties;
  gradientHeight?: number;
  gradientFrom?: string;
  gradientTo?: string;
  topGradientStyle?: CSSProperties;
  bottomGradientStyle?: CSSProperties;
}

export default function Counter({
  value,
  fontSize = 48,
  padding = 0,
  places,
  gap = 2,
  borderRadius = 4,
  horizontalPadding = 0,
  textColor = 'inherit',
  fontWeight = 'inherit',
  containerStyle,
  counterStyle,
  digitStyle,
  gradientHeight = 0,
  gradientFrom = 'transparent',
  gradientTo = 'transparent',
  topGradientStyle,
  bottomGradientStyle,
}: CounterProps) {
  const strVal = Math.round(value).toString();
  const computedPlaces = places ?? [...strVal].map((ch, i, a) => {
    if (ch === '.') {
      return '.';
    } else {
      return (
        10 **
        (a.indexOf('.') === -1 ? a.length - i - 1 : i < a.indexOf('.') ? a.indexOf('.') - i - 1 : -(i - a.indexOf('.')))
      );
    }
  });

  const height = fontSize + padding;
  const defaultCounterStyle: CSSProperties = {
    fontSize,
    gap,
    borderRadius,
    paddingLeft: horizontalPadding,
    paddingRight: horizontalPadding,
    color: textColor,
    fontWeight,
    direction: 'ltr',
  };
  const defaultTopGradientStyle: CSSProperties = {
    height: gradientHeight,
    background: `linear-gradient(to bottom, ${gradientFrom}, ${gradientTo})`,
  };
  const defaultBottomGradientStyle: CSSProperties = {
    height: gradientHeight,
    background: `linear-gradient(to top, ${gradientFrom}, ${gradientTo})`,
  };

  return (
    <span className="counter-container" style={containerStyle}>
      <span className="counter-counter" style={{ ...defaultCounterStyle, ...counterStyle }}>
        {computedPlaces.map((place, idx) => (
          <Digit key={`${place}-${idx}`} place={place} value={value} height={height} digitStyle={digitStyle} />
        ))}
      </span>
      {gradientHeight > 0 && (
        <span className="gradient-container">
          <span className="top-gradient" style={topGradientStyle ? topGradientStyle : defaultTopGradientStyle}></span>
          <span
            className="bottom-gradient"
            style={bottomGradientStyle ? bottomGradientStyle : defaultBottomGradientStyle}
          ></span>
        </span>
      )}
    </span>
  );
}
