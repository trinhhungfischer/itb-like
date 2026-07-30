export interface HeroData {
  id: string;
  name: string;
  hp: number;
  maxHp: number;
  abilityColorClass: string;
}

export class BattleHud {
  private container: HTMLElement;
  private zoneC: HTMLElement;

  constructor() {
    this.container = document.getElementById('battle-hud') as HTMLElement;
    this.zoneC = document.createElement('div');
    this.zoneC.id = 'zone-c';
    this.container.appendChild(this.zoneC);
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
}
