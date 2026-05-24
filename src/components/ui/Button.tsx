import { TouchableOpacity, Text, ActivityIndicator, type TouchableOpacityProps } from 'react-native';

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends TouchableOpacityProps {
  children: React.ReactNode;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  fullWidth?: boolean;
}

const variantStyles: Record<Variant, string> = {
  primary: 'bg-primary-500 active:bg-primary-600',
  secondary: 'bg-surface-secondary active:bg-surface-tertiary border border-border',
  outline: 'bg-transparent border border-primary-500 active:bg-primary-50',
  ghost: 'bg-transparent active:bg-surface-secondary',
  danger: 'bg-red-500 active:bg-red-600',
};

const textStyles: Record<Variant, string> = {
  primary: 'text-white',
  secondary: 'text-text-primary',
  outline: 'text-primary-600',
  ghost: 'text-text-primary',
  danger: 'text-white',
};

const sizeStyles: Record<Size, string> = {
  sm: 'px-3 py-2 rounded-lg',
  md: 'px-4 py-3 rounded-xl',
  lg: 'px-6 py-4 rounded-2xl',
};

const textSizeStyles: Record<Size, string> = {
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-lg',
};

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  disabled,
  className = '',
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      className={`
        flex-row items-center justify-center
        ${variantStyles[variant]}
        ${sizeStyles[size]}
        ${fullWidth ? 'w-full' : 'self-start'}
        ${isDisabled ? 'opacity-50' : ''}
        ${className}
      `}
      disabled={isDisabled}
      activeOpacity={0.8}
      {...props}
    >
      {loading && (
        <ActivityIndicator
          size="small"
          color={variant === 'primary' || variant === 'danger' ? '#ffffff' : '#22c55e'}
          className="mr-2"
        />
      )}
      <Text
        className={`font-semibold ${textStyles[variant]} ${textSizeStyles[size]}`}
        style={{ fontFamily: 'Inter_600SemiBold' }}
      >
        {children}
      </Text>
    </TouchableOpacity>
  );
}
