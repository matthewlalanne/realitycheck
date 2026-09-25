import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, ViewStyle } from 'react-native';

// A card that flips between a "back" and "front" face using a real 3D rotateY
// transform (no extra native deps needed — Animated handles this natively).
export default function FlipCard({
  flipped,
  front,
  back,
  style,
}: {
  flipped: boolean;
  front: React.ReactNode;
  back: React.ReactNode;
  style?: ViewStyle;
}) {
  const rotate = useRef(new Animated.Value(flipped ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(rotate, { toValue: flipped ? 1 : 0, duration: 350, useNativeDriver: true }).start();
  }, [flipped, rotate]);

  const frontRotate = rotate.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });
  const backRotate = rotate.interpolate({ inputRange: [0, 1], outputRange: ['180deg', '360deg'] });

  return (
    <Animated.View style={style}>
      <Animated.View
        style={[styles.face, { transform: [{ rotateY: backRotate }] }]}
        pointerEvents={flipped ? 'auto' : 'none'}
      >
        {front}
      </Animated.View>
      <Animated.View
        style={[styles.face, { transform: [{ rotateY: frontRotate }] }]}
        pointerEvents={flipped ? 'none' : 'auto'}
      >
        {back}
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  face: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backfaceVisibility: 'hidden',
  },
});
