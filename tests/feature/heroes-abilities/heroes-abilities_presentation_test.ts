import { HeroPresentation } from '../../../src/feature/heroes-abilities/presentation';
import { Hero } from '../../../src/feature/heroes-abilities/unit';
import { Tile } from '../../../src/core/board/board-interface';
import { describe, it, expect, beforeEach } from 'vitest';

describe('HeroPresentation', () => {
    let presentation: HeroPresentation;
    let mockTile: Tile;
    let mockHero: Hero;

    beforeEach(() => {
        presentation = new HeroPresentation();
        mockTile = { q: 0, r: 0, s: 0 };
        mockHero = {
            id: 'hero-1',
            owner: 'player',
            type: 'melee',
            stats: { hp: 10, maxHp: 10, movement: 3 },
            position: mockTile
        };
    });

    it('should record legal-move and legal-target distinct from hazards', () => {
        presentation.recordHighlight({ q: 1, r: 0, s: -1 }, 'legal-move');
        presentation.recordHighlight({ q: 2, r: 0, s: -2 }, 'legal-target');
        presentation.recordHighlight({ q: 3, r: 0, s: -3 }, 'hazard');
        
        const highlights = presentation.getActiveHighlights();
        expect(highlights).toHaveLength(3);
        
        const moveStyle = highlights.find(h => h.tile.q === 1)!.style;
        const targetStyle = highlights.find(h => h.tile.q === 2)!.style;
        const hazardStyle = highlights.find(h => h.tile.q === 3)!.style;

        // Verify distinct highlight sets
        expect(moveStyle.color).not.toBe(hazardStyle.color);
        expect(targetStyle.color).not.toBe(hazardStyle.color);
        expect(moveStyle.color).not.toBe(targetStyle.color);
    });

    it('should support explicit direction choice for Line abilities', () => {
        presentation.recordHighlight(mockTile, 'line-direction');
        
        const highlights = presentation.getActiveHighlights();
        expect(highlights).toHaveLength(1);
        expect(highlights[0].style.color).toBe(0xFFFF00); // Yellow for direction
    });

    it('should enforce silhouette-first hero identity and verb-family colors', () => {
        presentation.recordHeroIdentity(mockHero);
        
        const identity = presentation.getCurrentHeroIdentity();
        expect(identity).not.toBeNull();
        expect(identity!.silhouetteFirst).toBe(true);
        expect(identity!.accentColor).toBeDefined();
    });

    it('should clear highlights correctly', () => {
        presentation.recordHighlight(mockTile, 'legal-move');
        presentation.clearHighlights();
        expect(presentation.getActiveHighlights()).toHaveLength(0);
    });
});
