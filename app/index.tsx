import { useEffect, useState } from 'react';
import { Redirect } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { useAuthStore } from '../src/stores/auth.store';
import { StorageService } from '../src/services/storage/storage.service';

export default function Index() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);
  const [onboardingChecked, setOnboardingChecked] = useState(false);
  const [hasOnboarded, setHasOnboarded] = useState(false);

  useEffect(() => {
    StorageService.isOnboarded().then((result) => {
      setHasOnboarded(result);
      setOnboardingChecked(true);
    });
  }, []);

  if (isLoading || !onboardingChecked) {
    return (
      <View className="flex-1 items-center justify-center bg-primary-500">
        <ActivityIndicator color="#ffffff" size="large" />
      </View>
    );
  }

  if (!isAuthenticated) return <Redirect href="/(auth)/login" />;
  if (!hasOnboarded) return <Redirect href="/onboarding" />;

  return <Redirect href="/(app)/(tabs)/home" />;
}
