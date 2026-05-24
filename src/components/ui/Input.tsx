import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, type TextInputProps } from 'react-native';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  hint?: string;
}

export function Input({ label, error, hint, className = '', secureTextEntry, ...props }: InputProps) {
  const [hidden, setHidden] = useState(true);
  const isPassword = secureTextEntry !== undefined;

  return (
    <View className="w-full">
      {label && (
        <Text
          className="text-sm text-text-secondary mb-1.5"
          style={{ fontFamily: 'Inter_500Medium' }}
        >
          {label}
        </Text>
      )}
      <View className="relative">
        <TextInput
          className={`
            w-full bg-surface-secondary border rounded-xl px-4 py-3
            text-base text-text-primary
            ${error ? 'border-red-400' : 'border-border'}
            ${isPassword ? 'pr-12' : ''}
            ${className}
          `}
          style={{ fontFamily: 'Inter_400Regular' }}
          placeholderTextColor="#94a3b8"
          secureTextEntry={isPassword ? hidden : false}
          {...props}
        />
        {isPassword && (
          <TouchableOpacity
            onPress={() => setHidden((h) => !h)}
            className="absolute right-3 top-0 bottom-0 items-center justify-center px-1"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text className="text-text-muted text-lg">{hidden ? '👁' : '🙈'}</Text>
          </TouchableOpacity>
        )}
      </View>
      {error && (
        <Text className="text-red-500 text-xs mt-1" style={{ fontFamily: 'Inter_400Regular' }}>
          {error}
        </Text>
      )}
      {hint && !error && (
        <Text className="text-text-muted text-xs mt-1" style={{ fontFamily: 'Inter_400Regular' }}>
          {hint}
        </Text>
      )}
    </View>
  );
}
