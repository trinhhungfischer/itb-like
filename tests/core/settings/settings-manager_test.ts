import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SettingsManager, defaultSettings, SettingsEvents } from '../../../src/core/settings/settings-manager';
import { Persistence } from '../../../src/foundation/run-persistence/persistence';
import { EventBus } from '../../../src/core/events/event-bus';

describe('SettingsManager', () => {
  let mockPersistence: Persistence;
  let mockEventBus: EventBus<SettingsEvents>;

  beforeEach(() => {
    mockPersistence = {
      saveRun: vi.fn(),
      loadRun: vi.fn(),
      clearRun: vi.fn(),
      saveMeta: vi.fn(),
      loadMeta: vi.fn().mockReturnValue({ kind: 'Empty' }),
      mergeUnlocksIntoMeta: vi.fn(),
      isStorageAvailable: vi.fn().mockReturnValue(true)
    } as any;

    mockEventBus = {
      emit: vi.fn(),
      on: vi.fn(),
      off: vi.fn()
    } as any;
  });

  it('loads default settings when persistence is empty', () => {
    const manager = new SettingsManager(mockPersistence, mockEventBus);
    expect(manager.settings).toEqual(defaultSettings);
  });

  it('loads saved settings from persistence', () => {
    const savedSettings = {
      audio: { masterVolume: 0.5, musicVolume: 0.2, sfxVolume: 0.8 },
      video: { resolution: '1280x720', fullscreen: false },
      input: { keybindings: { jump: 'Space' } }
    };
    
    mockPersistence.loadMeta = vi.fn().mockReturnValue({
      kind: 'Valid',
      data: { settings: savedSettings }
    });

    const manager = new SettingsManager(mockPersistence, mockEventBus);
    expect(manager.settings).toEqual(savedSettings);
  });

  it('updates audio settings, saves to persistence, and emits events', () => {
    const manager = new SettingsManager(mockPersistence, mockEventBus);
    
    manager.updateAudio({ masterVolume: 0.3 });
    
    expect(manager.settings.audio.masterVolume).toBe(0.3);
    expect(mockPersistence.saveMeta).toHaveBeenCalledWith(expect.objectContaining({
      settings: expect.objectContaining({
        audio: expect.objectContaining({ masterVolume: 0.3 })
      })
    }));
    
    expect(mockEventBus.emit).toHaveBeenCalledWith({
      type: 'audio_settings_changed',
      audio: expect.objectContaining({ masterVolume: 0.3 })
    });
    expect(mockEventBus.emit).toHaveBeenCalledWith({
      type: 'settings_changed',
      data: manager.settings
    });
  });

  it('updates video settings, saves to persistence, and emits events', () => {
    const manager = new SettingsManager(mockPersistence, mockEventBus);
    
    manager.updateVideo({ fullscreen: false });
    
    expect(manager.settings.video.fullscreen).toBe(false);
    expect(mockPersistence.saveMeta).toHaveBeenCalledWith(expect.objectContaining({
      settings: expect.objectContaining({
        video: expect.objectContaining({ fullscreen: false })
      })
    }));
    
    expect(mockEventBus.emit).toHaveBeenCalledWith({
      type: 'video_settings_changed',
      video: expect.objectContaining({ fullscreen: false })
    });
  });

  it('updates input settings, saves to persistence, and emits events', () => {
    const manager = new SettingsManager(mockPersistence, mockEventBus);
    
    manager.updateInput({ keybindings: { moveLeft: 'A' } });
    
    expect(manager.settings.input.keybindings).toEqual({ moveLeft: 'A' });
    expect(mockPersistence.saveMeta).toHaveBeenCalledWith(expect.objectContaining({
      settings: expect.objectContaining({
        input: expect.objectContaining({ keybindings: { moveLeft: 'A' } })
      })
    }));
    
    expect(mockEventBus.emit).toHaveBeenCalledWith({
      type: 'input_settings_changed',
      input: expect.objectContaining({ keybindings: { moveLeft: 'A' } })
    });
  });
});
