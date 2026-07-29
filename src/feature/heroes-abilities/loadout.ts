import { HeroDefinition } from './unit';

export const SQUAD_SIZE = 3;

export class LoadoutError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'LoadoutError';
    }
}

export function createLoadout(heroes: HeroDefinition[]): HeroDefinition[] {
    if (heroes.length !== SQUAD_SIZE) {
        throw new LoadoutError(`Loadout must contain exactly ${SQUAD_SIZE} heroes.`);
    }

    const uniqueIds = new Set(heroes.map(h => h.id));
    if (uniqueIds.size !== heroes.length) {
        throw new LoadoutError('Loadout must contain distinct heroes (no duplicates).');
    }

    return [...heroes];
}
