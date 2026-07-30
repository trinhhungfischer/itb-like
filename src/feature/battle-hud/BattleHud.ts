export interface HeroData {
  id: string;
  name: string;
  hp: number;
  maxHp: number;
  abilityColorClass: string;
}

export interface ThreatData {
  source: string;
  intent: string;
  isLethal: boolean;
}

export interface EnemyHpData {
  id: string;
  hp: number;
  maxHp: number;
  x: number;
  y: number;
}

export interface InspectData {
  name: string;
  hp: number;
  maxHp: number;
  attack: number;
  speed: number;
  intents: string[];
}

export class BattleHud {
  private container: HTMLElement;
  private zoneC: HTMLElement;
  private zoneD: HTMLElement;
  private floatingLayer: HTMLElement;
  private inspectPanel: HTMLElement;

  constructor() {
    this.container = document.getElementById('battle-hud') as HTMLElement;
    
    this.zoneC = document.createElement('div');
    this.zoneC.id = 'zone-c';
    this.container.appendChild(this.zoneC);

    this.zoneD = document.createElement('div');
    this.zoneD.id = 'zone-d';
    this.container.appendChild(this.zoneD);

    this.floatingLayer = document.createElement('div');
    this.floatingLayer.id = 'floating-layer';
    this.floatingLayer.style.position = 'absolute';
    this.floatingLayer.style.top = '0';
    this.floatingLayer.style.left = '0';
    this.floatingLayer.style.width = '100%';
    this.floatingLayer.style.height = '100%';
    this.floatingLayer.style.pointerEvents = 'none';
    this.container.appendChild(this.floatingLayer);

    this.inspectPanel = document.createElement('div');
    this.inspectPanel.id = 'inspect-panel';
    this.container.appendChild(this.inspectPanel);

    this.setupInspectListeners();
  }

  private setupInspectListeners() {
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Alt') {
        this.showInspectPanel({
          name: 'Orc Boss',
          hp: 80,
          maxHp: 150,
          attack: 40,
          speed: 3,
          intents: ['Cleave (40 DMG)', 'Move (3 Tiles)']
        });
      }
    });

    window.addEventListener('keyup', (e) => {
      if (e.key === 'Alt') {
        this.hideInspectPanel();
      }
    });
  }

  public populateRoster(heroes: HeroData[]) {
    this.zoneC.innerHTML = '';
    
    heroes.forEach((hero, index) => {
      const card = document.createElement('div');
      card.className = `hero-card ${index === 0 ? 'active' : ''}`; // Select first by default for demo
      card.dataset.id = hero.id;

      card.addEventListener('click', () => {
        this.selectHero(hero.id);
      });

      const hpPercent = (hero.hp / hero.maxHp) * 100;

      card.innerHTML = `
        <div class="hero-portrait">${hero.name}</div>
        <div class="hero-hp-bar-container">
          <div class="hero-hp-bar-fill" style="width: ${hpPercent}%"></div>
          <div class="hero-hp-text">${hero.hp}/${hero.maxHp}</div>
        </div>
        <div class="hero-ability-row">
          <div class="ability-icon ${hero.abilityColorClass}"></div>
          <div class="ability-icon"></div>
        </div>
      `;

      this.zoneC.appendChild(card);
    });
  }

  public selectHero(id: string) {
    const cards = this.zoneC.querySelectorAll('.hero-card');
    cards.forEach(card => {
      if ((card as HTMLElement).dataset.id === id) {
        card.classList.add('active');
      } else {
        card.classList.remove('active');
      }
    });
  }

  public populateThreats(threats: ThreatData[]) {
    this.zoneD.innerHTML = '';
    
    threats.forEach(threat => {
      const card = document.createElement('div');
      card.className = 'threat-card';
      if (threat.isLethal) {
        card.style.borderLeftColor = 'var(--accent-lethal)';
      }
      
      card.innerHTML = `
        <div class="threat-icon" style="background-color: ${threat.isLethal ? 'var(--accent-lethal)' : 'var(--accent-intent)'}"></div>
        <div class="threat-text">
          <span class="threat-source">${threat.source}</span>
          <span class="threat-intent">${threat.intent}</span>
        </div>
      `;
      this.zoneD.appendChild(card);
    });
  }

  public renderEnemyHpBars(enemies: EnemyHpData[]) {
    this.floatingLayer.innerHTML = '';

    enemies.forEach(enemy => {
      const hpPercent = (enemy.hp / enemy.maxHp) * 100;
      const el = document.createElement('div');
      el.className = 'enemy-hp-container';
      el.style.left = `${enemy.x}px`;
      el.style.top = `${enemy.y}px`;
      el.style.transform = 'translate(-50%, -100%)'; // center above point

      el.innerHTML = `
        <div class="enemy-hp-text">${enemy.hp}/${enemy.maxHp}</div>
        <div class="enemy-hp-bar">
          <div class="enemy-hp-fill" style="width: ${hpPercent}%"></div>
        </div>
      `;
      this.floatingLayer.appendChild(el);
    });
  }

  public showInspectPanel(data: InspectData) {
    this.inspectPanel.style.display = 'block';
    // push zone c down or make it transparent per spec
    this.zoneC.style.opacity = '0.5';

    this.inspectPanel.innerHTML = `
      <div class="inspect-header">
        <span>${data.name}</span>
        <span style="color: var(--accent-intent)">${data.hp}/${data.maxHp} HP</span>
      </div>
      <div class="inspect-stats">
        <div class="inspect-stat-row">
          <span class="inspect-stat-label">Attack</span>
          <span>${data.attack}</span>
        </div>
        <div class="inspect-stat-row">
          <span class="inspect-stat-label">Speed</span>
          <span>${data.speed}</span>
        </div>
      </div>
      <div class="inspect-intents">
        <div class="inspect-intents-title">Next Turn Intents</div>
        ${data.intents.map(i => `<div>${i}</div>`).join('')}
      </div>
    `;
  }

  public hideInspectPanel() {
    this.inspectPanel.style.display = 'none';
    this.zoneC.style.opacity = '1';
  }
}
