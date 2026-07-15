import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Line } from 'react-native-svg';

// The Focus tab's shared surface texture: fine 45° hairlines woven across the
// whole card, in the surface's own accent color, barely above the gradient.

export default function HairlineWeave({
  color,
  opacity = 0.05,
}: {
  color: string;
  opacity?: number;
}) {
  const [box, setBox] = useState({ w: 0, h: 0 });
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
                stroke={color}
                strokeOpacity={opacity}
                strokeWidth={1}
              />
            );
          })}
        </Svg>
      )}
    </View>
  );
}
