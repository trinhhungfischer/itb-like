import { SettingsManager } from '../../core/settings/settings-manager';

export type ConflictResolution = 'swap' | 'cancel';

export interface KeybindingConflictUI {
  promptConflict(action: string, key: string, conflictingAction: string): Promise<ConflictResolution>;
}

/**
 * Handles assigning keys to actions, including conflict resolution.
 */
export class KeybindingResolver {
  constructor(
    private settingsManager: SettingsManager,
    private ui: KeybindingConflictUI
  ) {}

  /**
   * Attempts to assign a key to an action.
   * If the key is already bound to another action, prompts the user to swap or cancel.
   */
  async assignKey(action: string, key: string): Promise<boolean> {
    const currentKeybindings = this.settingsManager.settings.input.keybindings;
    
    let conflictingAction: string | null = null;
    for (const [existingAction, existingKey] of Object.entries(currentKeybindings)) {
      if (existingKey === key && existingAction !== action) {
        conflictingAction = existingAction;
        break;
      }
    }

    if (conflictingAction) {
      const resolution = await this.ui.promptConflict(action, key, conflictingAction);
      if (resolution === 'cancel') {
        return false;
      }
      
      // Swap the keys
      const previousKeyForAction = currentKeybindings[action];
      const newBindings = { ...currentKeybindings };
      
      newBindings[action] = key;
      if (previousKeyForAction) {
        newBindings[conflictingAction] = previousKeyForAction;
      } else {
        delete newBindings[conflictingAction];
      }
      
      this.settingsManager.updateInput({ keybindings: newBindings });
      return true;
    }

    // No conflict
    this.settingsManager.updateInput({ 
      keybindings: { ...currentKeybindings, [action]: key } 
    });
    return true;
  }
}
