import { describe, it, expect, beforeEach } from 'vitest';
import { 
    AccessibilityValidationGate, 
    DEFAULT_ACCESSIBILITY_SETTINGS, 
    getAccessibilitySettings, 
    getTextColorHook, 
    getTextSizeHook, 
    updateAccessibilitySettings, 
    validateGate 
} from '../../../src/foundation/accessibility/accessibility-gates';

describe('Accessibility Gates', () => {
    beforeEach(() => {
        updateAccessibilitySettings(DEFAULT_ACCESSIBILITY_SETTINGS);
    });

    it('should define V1-V11 validation gates', () => {
        expect(AccessibilityValidationGate.V1_CONTRAST_RATIO).toBe('V1_CONTRAST_RATIO');
        expect(AccessibilityValidationGate.V11_SCREEN_READER).toBe('V11_SCREEN_READER');
    });

    it('should fetch and update accessibility settings', () => {
        expect(getAccessibilitySettings().highContrast).toBe(false);
        
        updateAccessibilitySettings({ highContrast: true });
        
        expect(getAccessibilitySettings().highContrast).toBe(true);
    });

    it('should apply text and color hooks', () => {
        expect(getTextColorHook('#000000', '#ffffff')).toBe('#000000');
        expect(getTextSizeHook(16)).toBe(16);
        
        updateAccessibilitySettings({ highContrast: true, textScaleMultiplier: 1.5 });
        
        expect(getTextColorHook('#000000', '#ffffff')).toBe('#ffffff');
        expect(getTextSizeHook(16)).toBe(24);
    });

    it('should validate gate correctly', () => {
        const resultTrue = validateGate(AccessibilityValidationGate.V1_CONTRAST_RATIO, () => true);
        const resultFalse = validateGate(AccessibilityValidationGate.V2_COLORBLIND_SAFE, () => false);
        
        expect(resultTrue).toBe(true);
        expect(resultFalse).toBe(false);
    });
});
