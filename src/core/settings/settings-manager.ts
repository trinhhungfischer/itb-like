import { EventBus } from '../events/event-bus';
import { Persistence } from '../../foundation/run-persistence/persistence';

export interface SettingsData {
  audio: {
    masterVolume: number;
    musicVolume: number;
    sfxVolume: number;
  };
  video: {
    resolution: string;
    fullscreen: boolean;
  };
  input: {
    keybindings: Record<string, string>;
  };
}

export const defaultSettings: SettingsData = {
  audio: { masterVolume: 1, musicVolume: 1, sfxVolume: 1 },
  video: { resolution: '1920x1080', fullscreen: true },
  input: { keybindings: {} }
};

export type SettingsEvents = {
  settings_changed: { type: 'settings_changed'; data: SettingsData };
  audio_settings_changed: { type: 'audio_settings_changed'; audio: SettingsData['audio'] };
  video_settings_changed: { type: 'video_settings_changed'; video: SettingsData['video'] };
  input_settings_changed: { type: 'input_settings_changed'; input: SettingsData['input'] };
};

export class SettingsManager {
  private data: SettingsData;
  
  constructor(
    private persistence: Persistence,
    private eventBus: EventBus<SettingsEvents>
  ) {
    const loaded = this.persistence.loadMeta();
    if (loaded.kind === 'Valid' && typeof loaded.data === 'object' && loaded.data !== null) {
      const metaData = loaded.data as any;
      this.data = metaData.settings ? { ...defaultSettings, ...metaData.settings } : { ...defaultSettings };
    } else {
      this.data = { ...defaultSettings };
    }
  }

  get settings(): SettingsData {
    return this.data;
  }

  updateAudio(audio: Partial<SettingsData['audio']>) {
    this.data.audio = { ...this.data.audio, ...audio };
    this.save();
    this.eventBus.emit({ type: 'audio_settings_changed', audio: this.data.audio });
    this.eventBus.emit({ type: 'settings_changed', data: this.data });
  }

  updateVideo(video: Partial<SettingsData['video']>) {
    this.data.video = { ...this.data.video, ...video };
    this.save();
    this.eventBus.emit({ type: 'video_settings_changed', video: this.data.video });
    this.eventBus.emit({ type: 'settings_changed', data: this.data });
  }

  updateInput(input: Partial<SettingsData['input']>) {
    this.data.input = { ...this.data.input, ...input };
    this.save();
    this.eventBus.emit({ type: 'input_settings_changed', input: this.data.input });
    this.eventBus.emit({ type: 'settings_changed', data: this.data });
  }

  private save() {
    const loaded = this.persistence.loadMeta();
    let metaData: any = {};
    if (loaded.kind === 'Valid' && typeof loaded.data === 'object' && loaded.data !== null) {
      metaData = loaded.data;
    }
    metaData.settings = this.data;
    this.persistence.saveMeta(metaData);
  }
}
