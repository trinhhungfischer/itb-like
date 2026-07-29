export enum AccessibilityValidationGate {
    V1_CONTRAST_RATIO = 'V1_CONTRAST_RATIO',
    V2_COLORBLIND_SAFE = 'V2_COLORBLIND_SAFE',
    V3_TEXT_SCALING = 'V3_TEXT_SCALING',
    V4_EPILEPSY_SAFE = 'V4_EPILEPSY_SAFE',
    V5_SUBTITLES = 'V5_SUBTITLES',
    V6_REMAP_CONTROLS = 'V6_REMAP_CONTROLS',
    V7_AUDIO_CUES = 'V7_AUDIO_CUES',
    V8_VISUAL_CUES = 'V8_VISUAL_CUES',
    V9_GAME_SPEED = 'V9_GAME_SPEED',
    V10_UI_SCALING = 'V10_UI_SCALING',
    V11_SCREEN_READER = 'V11_SCREEN_READER'
}

export interface AccessibilitySettings {
    colorBlindMode: 'none' | 'protanopia' | 'deuteranopia' | 'tritanopia';
    textScaleMultiplier: number;
    highContrast: boolean;
    reduceMotion: boolean;
}

export const DEFAULT_ACCESSIBILITY_SETTINGS: AccessibilitySettings = {
    colorBlindMode: 'none',
    textScaleMultiplier: 1.0,
    highContrast: false,
    reduceMotion: false,
};

let currentSettings = { ...DEFAULT_ACCESSIBILITY_SETTINGS };

export function updateAccessibilitySettings(settings: Partial<AccessibilitySettings>): void {
    currentSettings = { ...currentSettings, ...settings };
}

export function getAccessibilitySettings(): AccessibilitySettings {
    return { ...currentSettings };
}

export function getTextColorHook(baseColor: string, highContrastColor: string): string {
    return currentSettings.highContrast ? highContrastColor : baseColor;
}

export function getTextSizeHook(baseSize: number): number {
    return baseSize * currentSettings.textScaleMultiplier;
}

export function validateGate(gate: AccessibilityValidationGate, check: () => boolean): boolean {
    return check();
}
