import { useEffect, useRef } from 'react';
import { Animated, View, type ViewProps } from 'react-native';

interface SkeletonProps extends ViewProps {
  width?: number | `${number}%`;
  height?: number;
  borderRadius?: number;
}

export function Skeleton({ width = '100%', height = 16, borderRadius = 8, style, ...props }: SkeletonProps) {
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[{ width, height, borderRadius, backgroundColor: '#e2e8f0', opacity }, style]}
      {...props}
    />
  );
}

export function RunDetailSkeleton() {
  return (
    <View className="px-4 pt-4 gap-y-4">
      <Skeleton height={24} width="60%" />
      <Skeleton height={80} />
      <Skeleton height={16} width="40%" />
      {[1, 2, 3].map((i) => (
        <Skeleton key={i} height={88} borderRadius={16} />
      ))}
    </View>
  );
}
