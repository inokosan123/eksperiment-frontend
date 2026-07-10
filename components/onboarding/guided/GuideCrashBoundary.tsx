import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';
import { F } from '@/constants/tokens';

type Props = {
  // Names the segment in the error card, e.g. "Bible walkthrough".
  label: string;
  // Lets the user leave the broken segment and continue onboarding.
  onSkip: () => void;
  children: React.ReactNode;
};

type State = {
  error: Error | null;
};

// Guided tours drive real app screens — if one of them throws during render,
// this shows the actual error on screen (so it can be reported verbatim) and
// offers a way forward, instead of taking the whole onboarding down.
export class GuideCrashBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.warn(`[GuideCrashBoundary] ${this.props.label} crashed`, error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <View style={b.screen}>
        <View style={b.card}>
          <Text style={b.eyebrow}>SOMETHING BROKE</Text>
          <Text style={b.title}>{this.props.label} hit an error</Text>
          <ScrollView style={b.errorBox} showsVerticalScrollIndicator>
            <Text selectable style={b.errorText}>
              {this.state.error.message}
              {'\n\n'}
              {this.state.error.stack?.split('\n').slice(0, 12).join('\n')}
            </Text>
          </ScrollView>
          <TouchableOpacity activeOpacity={0.9} haptic="medium" onPress={this.props.onSkip} style={b.cta}>
            <Text style={b.ctaText}>Skip this part</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }
}

const b = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#FAF7F0',
  },
  card: {
    width: '100%',
    maxWidth: 360,
    maxHeight: '80%',
    borderRadius: 22,
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.3)',
  },
  eyebrow: {
    fontFamily: F.sansBold,
    fontSize: 10,
    letterSpacing: 2,
    color: '#B4231F',
    marginBottom: 6,
  },
  title: {
    fontFamily: F.serifSemiBold,
    fontSize: 21,
    color: '#15120F',
    marginBottom: 12,
  },
  errorBox: {
    maxHeight: 280,
    borderRadius: 12,
    padding: 12,
    backgroundColor: '#FBF4F1',
    borderWidth: 1,
    borderColor: 'rgba(180,35,31,0.2)',
    marginBottom: 14,
  },
  errorText: {
    fontFamily: F.sansMedium,
    fontSize: 12,
    lineHeight: 17,
    color: '#5A2320',
  },
  cta: {
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: '#15120F',
  },
  ctaText: {
    fontFamily: F.serifSemiBold,
    fontSize: 16,
    color: '#FFFFFF',
  },
});
