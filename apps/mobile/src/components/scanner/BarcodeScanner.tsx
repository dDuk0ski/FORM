import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { useEffect, useState, type ReactNode } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Linking,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { ROUND_BUTTON_SIZE, RoundBackButton } from '@/components/food/RoundBackButton';
import { useTheme } from '@/theme';

import { BarcodeEntry } from './BarcodeEntry';
import { codeFromScan, createScanGuard } from './scanGuard';
import { scannerColors } from './scannerColors';

// Reusable barcode scanner: camera with a framing guide, plus a typed-entry fallback. It
// knows nothing about food; it only reports a valid code through onScanned. Styled after
// Christian's "scan screen" mockup (black camera area, white corner brackets, green scan
// line, green caption pill, round white back button, gray lower panel). The mockup's tab bar and profile
// avatar are left out on purpose: this is a modal.

export const BARCODE_TYPES = ['ean13', 'ean8', 'upc_a', 'upc_e'] as const;

const BRACKET = 32;
const BRACKET_WIDTH = 4;

type BarcodeScannerProps = {
  /** A valid EAN-8 / UPC-A / EAN-13, from the camera or typed. Fires once per scan. */
  onScanned: (code: string) => void;
  /** The camera could not start (no camera, or it failed to mount). */
  onError?: (error: Error) => void;
  onBack: () => void;
  /**
   * False while the parent is busy with a code (looking it up, showing a result): the camera
   * and the "Look up" button ignore input. Setting it back to true allows the next scan.
   */
  active?: boolean;
  title?: string;
  caption?: string;
  /** Extra content for the lower panel, under the typed field (status, results). */
  children?: ReactNode;
};

function useReduceMotion(): boolean {
  // Static until we know, so nothing moves for someone who asked for less motion.
  const [reduce, setReduce] = useState(true);
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => mounted && setReduce(value))
      .catch(() => mounted && setReduce(false));
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);
  return reduce;
}

function ScanLine({ reduceMotion }: { reduceMotion: boolean }) {
  const [opacity] = useState(() => new Animated.Value(1));
  useEffect(() => {
    if (reduceMotion) {
      opacity.setValue(1);
      return undefined;
    }
    // A slow glow pulse in place: light on the CPU, and no movement across the screen.
    const pulse = (toValue: number) =>
      Animated.timing(opacity, {
        toValue,
        duration: 900,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      });
    const loop = Animated.loop(Animated.sequence([pulse(0.35), pulse(1)]));
    loop.start();
    return () => loop.stop();
  }, [opacity, reduceMotion]);

  return (
    <Animated.View
      testID={reduceMotion ? 'scan-line-static' : 'scan-line-animated'}
      style={{
        position: 'absolute',
        left: BRACKET_WIDTH,
        right: BRACKET_WIDTH,
        top: '50%',
        height: 2,
        borderRadius: 1,
        backgroundColor: scannerColors.scanLine,
        shadowColor: scannerColors.scanLine,
        shadowOpacity: 0.9,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 0 },
        elevation: 6,
        opacity,
      }}
    />
  );
}

function Corner({ position }: { position: 'tl' | 'tr' | 'bl' | 'br' }) {
  const { radii } = useTheme();
  const top = position[0] === 't';
  const left = position[1] === 'l';
  return (
    <View
      style={{
        position: 'absolute',
        width: BRACKET,
        height: BRACKET,
        borderColor: scannerColors.onCamera,
        [top ? 'top' : 'bottom']: 0,
        [left ? 'left' : 'right']: 0,
        [top ? 'borderTopWidth' : 'borderBottomWidth']: BRACKET_WIDTH,
        [left ? 'borderLeftWidth' : 'borderRightWidth']: BRACKET_WIDTH,
        [`border${top ? 'Top' : 'Bottom'}${left ? 'Left' : 'Right'}Radius`]: radii.md,
      }}
    />
  );
}

/** The framing guide: four white corner brackets and the glowing line across the middle. */
function Frame({ children, showLine }: { children?: ReactNode; showLine: boolean }) {
  const reduceMotion = useReduceMotion();
  return (
    <View style={{ width: '82%', aspectRatio: 1.6, justifyContent: 'center' }}>
      <View
        style={StyleSheet.absoluteFill}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Corner position="tl" />
        <Corner position="tr" />
        <Corner position="bl" />
        <Corner position="br" />
        {showLine ? <ScanLine reduceMotion={reduceMotion} /> : null}
      </View>
      {children}
    </View>
  );
}

function CameraMessage({
  title,
  message,
  action,
}: {
  title: string;
  message: string;
  action?: ReactNode;
}) {
  const { spacing, typography } = useTheme();
  return (
    <View
      accessibilityLiveRegion="polite"
      style={{ alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.xl }}
    >
      <Text style={[typography.heading, { color: scannerColors.onCamera, textAlign: 'center' }]}>
        {title}
      </Text>
      <Text style={[typography.body, { color: scannerColors.onCamera, textAlign: 'center' }]}>
        {message}
      </Text>
      {action}
    </View>
  );
}

export function BarcodeScanner({
  onScanned,
  onError,
  onBack,
  active = true,
  title = 'Scan barcode',
  caption = 'Fit the barcode inside the frame',
  children,
}: BarcodeScannerProps) {
  const { spacing, radii, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [asking, setAsking] = useState(false);
  const [cameraAvailable, setCameraAvailable] = useState(true);
  const [guard] = useState(() => createScanGuard());

  useEffect(() => {
    let mounted = true;
    // Only implemented on web; on iOS / Android it may throw, which means "ask the device".
    CameraView.isAvailableAsync()
      .then((available) => {
        if (mounted && !available) {
          setCameraAvailable(false);
        }
      })
      .catch(() => undefined);
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (active) {
      guard.release();
    }
  }, [active, guard]);

  const ask = async () => {
    setAsking(true);
    try {
      await requestPermission();
    } catch (error) {
      onError?.(error instanceof Error ? error : new Error('Could not ask for the camera.'));
    } finally {
      setAsking(false);
    }
  };

  const handleScan = (result: BarcodeScanningResult) => {
    if (!active) {
      return;
    }
    const code = codeFromScan(result.type, result.data);
    if (code && guard.accept(code)) {
      onScanned(code);
    }
  };

  const handleMountError = (event: { message: string }) => {
    setCameraAvailable(false);
    onError?.(new Error(event.message || 'The camera could not start.'));
  };

  let cameraContent: ReactNode;
  if (!cameraAvailable) {
    cameraContent = (
      <Frame showLine={false}>
        <CameraMessage title="No camera available" message="Type the barcode below instead." />
      </Frame>
    );
  } else if (permission === null || asking) {
    cameraContent = (
      <Frame showLine={false}>
        <CameraMessage title="Camera access" message="Asking for camera access…" />
      </Frame>
    );
  } else if (permission.granted) {
    cameraContent = (
      <>
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: [...BARCODE_TYPES] }}
          onBarcodeScanned={active ? handleScan : undefined}
          onMountError={handleMountError}
          accessibilityLabel="Camera viewfinder. Point the camera at a barcode."
        />
        <Frame showLine />
      </>
    );
  } else if (permission.status === 'undetermined' || permission.canAskAgain) {
    cameraContent = (
      <Frame showLine={false}>
        <CameraMessage
          title="Scan with your camera"
          message="FORM uses the camera only to read food barcodes."
          action={<Button title="Allow camera" variant="soft" onPress={() => void ask()} />}
        />
      </Frame>
    );
  } else {
    cameraContent = (
      <Frame showLine={false}>
        <CameraMessage
          title="Camera access is off"
          message="Turn on Camera for FORM in Settings, or type the barcode below."
          action={
            <Button
              title="Open Settings"
              variant="soft"
              onPress={() => void Linking.openSettings()}
            />
          }
        />
      </Frame>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: scannerColors.camera }}
    >
      <View
        style={{
          paddingTop: insets.top + spacing.sm,
          paddingHorizontal: spacing.lg,
          gap: spacing.md,
          alignItems: 'center',
          zIndex: 1,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch' }}>
          <RoundBackButton
            onPress={onBack}
            fill={scannerColors.backButton}
            iconColor={scannerColors.onBackButton}
          />
          <Text
            accessibilityRole="header"
            style={[
              typography.heading,
              { flex: 1, color: scannerColors.onCamera, textAlign: 'center' },
            ]}
          >
            {title}
          </Text>
          <View style={{ width: ROUND_BUTTON_SIZE }} />
        </View>
        <View
          style={{
            backgroundColor: scannerColors.caption,
            borderRadius: radii.pill,
            paddingVertical: spacing.sm,
            paddingHorizontal: spacing.xl,
          }}
        >
          <Text style={[typography.label, { color: scannerColors.onCaption }]}>{caption}</Text>
        </View>
      </View>

      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        {cameraContent}
      </View>

      <View
        style={{
          backgroundColor: scannerColors.panel,
          padding: spacing.lg,
          paddingBottom: Math.max(insets.bottom, spacing.lg),
          gap: spacing.lg,
        }}
      >
        <BarcodeEntry onSubmit={onScanned} disabled={!active} />
        {children}
      </View>
    </KeyboardAvoidingView>
  );
}
