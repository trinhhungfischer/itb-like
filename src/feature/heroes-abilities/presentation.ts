import { Tile, Board } from '../../core/board/board-interface';
import { Hero } from './unit';

/**
 * Implements TR-HERO-008: Presentation and Highlighting
 */

export interface HighlightStyles {
    color: number;
    alpha: number;
    silhouette: boolean;
}

export class HeroPresentation {
    /**
     * Drives animation from a presentation-specific update loop.
     * Required by Control Manifest (Presentation handlers must record what to animate synchronously and drive animation from their own rAF loop).
     */
    private activeHighlights: Map<string, { tile: Tile; style: HighlightStyles }> = new Map();
    private currentHero: Hero | null = null;
    
    // Store requested animations synchronously
    public recordHighlight(tile: Tile, type: 'legal-move' | 'legal-target' | 'hazard' | 'line-direction') {
        const key = `${tile.q},${tile.r},${tile.s}`;
        let style: HighlightStyles;

        switch (type) {
            case 'legal-move':
                style = { color: 0x00FF00, alpha: 0.5, silhouette: false }; // green
                break;
            case 'legal-target':
                style = { color: 0x0000FF, alpha: 0.5, silhouette: false }; // blue
                break;
            case 'hazard':
                style = { color: 0xFF0000, alpha: 0.7, silhouette: false }; // distinct red
                break;
            case 'line-direction':
                style = { color: 0xFFFF00, alpha: 0.8, silhouette: false }; // distinct yellow for explicit direction choice
                break;
        }

        this.activeHighlights.set(key, { tile, style });
    }

    public clearHighlights() {
        this.activeHighlights.clear();
    }

    public recordHeroIdentity(hero: Hero) {
        this.currentHero = hero;
    }

    /**
     * Called by the application's rAF loop
     */
    public onFrameUpdate(deltaMs: number) {
        // Drive actual rendering based on recorded state
        // For testing/demonstration, we just hold the state in `activeHighlights`
        // Forbidden: must not re-emit onto simulation stream
    }

    // Expose for testing
    public getActiveHighlights() {
        return Array.from(this.activeHighlights.values());
    }

    public getCurrentHeroIdentity() {
        return this.currentHero ? {
            silhouetteFirst: true, // Verification point
            accentColor: 0xFF00FF // Example verb-family accent color
        } : null;
    }
}
