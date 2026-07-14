import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';

// The quiet "instrument face" behind Screen Time cards: a laid-paper weave of
// diagonal hairlines across the whole surface, and an orbit system in the top
// right — dashed and solid rings with one satellite dot — echoing the day
// clock. Everything draws in the plan's own colors, barely above the gradient.

type BackdropVisual = {
  accent: string;
  bloom: string;
};

export default function PlanCardBackdrop({
  visual,
  compact = false,
}: {
  visual: BackdropVisual;
  compact?: boolean;
}) {
  const [box, setBox] = useState({ w: 0, h: 0 });
  const ring = compact ? 150 : 230;
  const cx = ring / 2;

  // Diagonal hairlines: one line every `step` px along the top edge, drawn at
  // 45° so together they read as a fine woven texture, not stripes.
  const step = 30;
  const lineCount = box.w > 0 ? Math.ceil((box.w + box.h) / step) + 1 : 0;

  return (
    <View
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      onLayout={event => {
        const { width, height } = event.nativeEvent.layout;
        setBox({ w: width, h: height });
      }}
    >
      {lineCount > 0 && (
        <Svg width={box.w} height={box.h} style={StyleSheet.absoluteFill}>
          {Array.from({ length: lineCount }).map((_, index) => {
            const offset = index * step;
            return (
              <Line
                key={index}
                x1={offset}
                y1={-4}
                x2={offset - box.h - 8}
                y2={box.h + 4}
                stroke={visual.accent}
                strokeOpacity={0.045}
                strokeWidth={1}
              />
            );
          })}
        </Svg>
      )}
      <View
        style={{
          position: 'absolute',
          right: -ring * 0.24,
          top: -ring * 0.28,
          width: ring,
          height: ring,
          borderRadius: ring / 2,
          backgroundColor: visual.bloom,
          opacity: 0.5,
        }}
      />
      <Svg
        width={ring}
        height={ring}
        style={{ position: 'absolute', right: -ring * 0.24, top: -ring * 0.28 }}
      >
        {/* Outer orbit — fine dotted */}
        <Circle cx={cx} cy={cx} r={ring * 0.47} stroke={visual.accent} strokeOpacity={0.13} strokeWidth={1} fill="none" strokeDasharray="1 6" />
        {/* Main solid orbit */}
        <Circle cx={cx} cy={cx} r={ring * 0.385} stroke={visual.accent} strokeOpacity={0.2} strokeWidth={1} fill="none" />
        {/* Bezel ring: 24 hour ticks, the day-clock echo */}
        {Array.from({ length: 24 }).map((_, index) => {
          const angle = (index / 24) * Math.PI * 2;
          const strong = index % 6 === 0;
          const r1 = ring * (strong ? 0.285 : 0.295);
          const r2 = ring * 0.325;
          return (
            <Line
              key={index}
              x1={cx + r1 * Math.cos(angle)}
              y1={cx + r1 * Math.sin(angle)}
              x2={cx + r2 * Math.cos(angle)}
              y2={cx + r2 * Math.sin(angle)}
              stroke={visual.accent}
              strokeOpacity={strong ? 0.26 : 0.15}
              strokeWidth={strong ? 1.3 : 1}
            />
          );
        })}
        {/* Inner orbits */}
        <Circle cx={cx} cy={cx} r={ring * 0.22} stroke={visual.accent} strokeOpacity={0.14} strokeWidth={1} fill="none" strokeDasharray="1 4" />
        <Circle cx={cx} cy={cx} r={ring * 0.135} stroke={visual.accent} strokeOpacity={0.1} strokeWidth={1} fill="none" />
        {/* Center */}
        <Circle cx={cx} cy={cx} r={2.2} fill={visual.accent} fillOpacity={0.24} />
        {/* Orbit nodes: a ringed satellite on the main orbit, plain dots elsewhere */}
        <Circle
          cx={cx + ring * 0.385 * Math.cos(-2.1)}
          cy={cx + ring * 0.385 * Math.sin(-2.1)}
          r={4.6}
          stroke={visual.accent}
          strokeOpacity={0.3}
          strokeWidth={1}
          fill="none"
        />
        <Circle
          cx={cx + ring * 0.385 * Math.cos(-2.1)}
          cy={cx + ring * 0.385 * Math.sin(-2.1)}
          r={2.2}
          fill={visual.accent}
          fillOpacity={0.36}
        />
        <Circle
          cx={cx + ring * 0.47 * Math.cos(-0.7)}
          cy={cx + ring * 0.47 * Math.sin(-0.7)}
          r={1.7}
          fill={visual.accent}
          fillOpacity={0.22}
        />
        <Circle
          cx={cx + ring * 0.22 * Math.cos(2.6)}
          cy={cx + ring * 0.22 * Math.sin(2.6)}
          r={1.8}
          fill={visual.accent}
          fillOpacity={0.26}
        />
        <Circle
          cx={cx + ring * 0.47 * Math.cos(2.0)}
          cy={cx + ring * 0.47 * Math.sin(2.0)}
          r={1.4}
          fill={visual.accent}
          fillOpacity={0.18}
        />
      </Svg>
    </View>
  );
}
