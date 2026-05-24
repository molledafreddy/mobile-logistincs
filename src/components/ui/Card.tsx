import { View, type ViewProps } from 'react-native';

interface CardProps extends ViewProps {
  children: React.ReactNode;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

const paddingStyles = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-5',
};

export function Card({ children, padding = 'md', className = '', ...props }: CardProps) {
  return (
    <View
      className={`bg-white rounded-2xl shadow-sm border border-border ${paddingStyles[padding]} ${className}`}
      {...props}
    >
      {children}
    </View>
  );
}
