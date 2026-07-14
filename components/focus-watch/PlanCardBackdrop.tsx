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
        <Circle cx={cx} cy={cx} r={ring * 0.47} stroke={visual.accent} strokeOpacity={0.13} strokeWidth={1} fill="none" strokeDasharray="1 6" />
        <Circle cx={cx} cy={cx} r={ring * 0.36} stroke={visual.accent} strokeOpacity={0.2} strokeWidth={1} fill="none" />
        <Circle cx={cx} cy={cx} r={ring * 0.25} stroke={visual.accent} strokeOpacity={0.12} strokeWidth={1} fill="none" strokeDasharray="1 4" />
        <Circle
          cx={cx + ring * 0.36 * Math.cos(-2.1)}
          cy={cx + ring * 0.36 * Math.sin(-2.1)}
          r={2.6}
          fill={visual.accent}
          fillOpacity={0.34}
        />
        <Circle
          cx={cx + ring * 0.47 * Math.cos(-0.7)}
          cy={cx + ring * 0.47 * Math.sin(-0.7)}
          r={1.7}
          fill={visual.accent}
          fillOpacity={0.22}
        />
      </Svg>
    </View>
  );
}
