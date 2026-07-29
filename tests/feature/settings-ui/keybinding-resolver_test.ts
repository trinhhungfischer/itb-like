import { describe, it, expect, vi, beforeEach } from 'vitest';
import { KeybindingResolver, KeybindingConflictUI } from '../../../src/feature/settings-ui/keybinding-resolver';
import { SettingsManager, defaultSettings } from '../../../src/core/settings/settings-manager';

describe('KeybindingResolver', () => {
  let mockSettingsManager: any;
  let mockUI: any;
  let currentSettings: any;

  beforeEach(() => {
    currentSettings = {
      ...defaultSettings,
      input: {
        keybindings: {
          jump: 'Space',
          attack: 'J',
          dash: 'K'
        }
      }
    };

    mockSettingsManager = {
      get settings() {
        return currentSettings;
      },
      updateInput: vi.fn((input) => {
        currentSettings.input = { ...currentSettings.input, ...input };
      })
    };

    mockUI = {
      promptConflict: vi.fn()
    };
  });

  it('assigns key without conflict', async () => {
    const resolver = new KeybindingResolver(mockSettingsManager as any, mockUI as any);
    const result = await resolver.assignKey('moveLeft', 'A');
    
    expect(result).toBe(true);
    expect(mockSettingsManager.updateInput).toHaveBeenCalledWith({
      keybindings: expect.objectContaining({ moveLeft: 'A', jump: 'Space' })
    });
    expect(mockUI.promptConflict).not.toHaveBeenCalled();
  });

  it('cancels assignment on conflict', async () => {
    const resolver = new KeybindingResolver(mockSettingsManager as any, mockUI as any);
    mockUI.promptConflict.mockResolvedValue('cancel');

    const result = await resolver.assignKey('moveLeft', 'Space');
    
    expect(result).toBe(false);
    expect(mockUI.promptConflict).toHaveBeenCalledWith('moveLeft', 'Space', 'jump');
    expect(mockSettingsManager.updateInput).not.toHaveBeenCalled();
  });

  it('swaps keys on conflict', async () => {
    const resolver = new KeybindingResolver(mockSettingsManager as any, mockUI as any);
    mockUI.promptConflict.mockResolvedValue('swap');

    // Currently: jump = Space, attack = J. We assign attack to Space.
    // Expected: attack = Space, jump = J.
    const result = await resolver.assignKey('attack', 'Space');
    
    expect(result).toBe(true);
    expect(mockUI.promptConflict).toHaveBeenCalledWith('attack', 'Space', 'jump');
    expect(mockSettingsManager.updateInput).toHaveBeenCalledWith({
      keybindings: expect.objectContaining({ attack: 'Space', jump: 'J' })
    });
  });

  it('swaps keys on conflict when new action has no previous key', async () => {
    const resolver = new KeybindingResolver(mockSettingsManager as any, mockUI as any);
    mockUI.promptConflict.mockResolvedValue('swap');

    // Currently: jump = Space, moveLeft is unbound. We assign moveLeft to Space.
    // Expected: moveLeft = Space, jump is unbound (deleted).
    const result = await resolver.assignKey('moveLeft', 'Space');
    
    expect(result).toBe(true);
    expect(mockUI.promptConflict).toHaveBeenCalledWith('moveLeft', 'Space', 'jump');
    expect(currentSettings.input.keybindings.moveLeft).toBe('Space');
    expect(currentSettings.input.keybindings.jump).toBeUndefined();
  });
});
