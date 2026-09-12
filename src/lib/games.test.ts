import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDatabase } from '../../db/test-helpers';
import { categories, publishers, games } from '../../db/schema';
import type { Database } from './db';
import {
    getAllGames,
    getAllGameIds,
    getGameById,
    getGamesByFilter,
} from './games';

async function seedGames(db: Database, count: number): Promise<void> {
    const [category] = await db
        .insert(categories)
        .values({ name: 'Strategy', description: 'cat' })
        .returning({ id: categories.id });
    const [publisher] = await db
        .insert(publishers)
        .values({ name: 'Pub One', description: 'pub' })
        .returning({ id: publishers.id });

    // Insert titles in reverse-alphabetical order to prove ordering is applied.
    for (let i = count; i >= 1; i--) {
        await db.insert(games).values({
            title: `Game ${String(i).padStart(2, '0')}`,
            description: `Description ${i}`,
            starRating: 4.2,
            categoryId: category.id,
            publisherId: publisher.id,
        });
    }
}

async function seedFilteredGames(db: Database): Promise<{ strategyId: number; puzzleId: number; codeForgeId: number; devMastersId: number }> {
    const [strategy] = await db
        .insert(categories)
        .values({ name: 'Strategy', description: 'strategy category' })
        .returning({ id: categories.id });
    const [puzzle] = await db
        .insert(categories)
        .values({ name: 'Puzzle', description: 'puzzle category' })
        .returning({ id: categories.id });
    const [codeForge] = await db
        .insert(publishers)
        .values({ name: 'CodeForge Studios', description: 'code forge' })
        .returning({ id: publishers.id });
    const [devMasters] = await db
        .insert(publishers)
        .values({ name: 'DevMasters Inc.', description: 'dev masters' })
        .returning({ id: publishers.id });

    const records = [
        ['Alpha', strategy.id, codeForge.id],
        ['Bravo', strategy.id, devMasters.id],
        ['Charlie', puzzle.id, codeForge.id],
        ['Delta', puzzle.id, devMasters.id],
    ] as const;

    for (const [title, categoryId, publisherId] of records) {
        await db.insert(games).values({
            title,
            description: `${title} description`,
            starRating: 4.5,
            categoryId,
            publisherId,
        });
    }

    return { strategyId: strategy.id, puzzleId: puzzle.id, codeForgeId: codeForge.id, devMastersId: devMasters.id };
}

describe('games data-access helpers', () => {
    let db: Database;

    beforeEach(async () => {
        db = await createTestDatabase();
    });

    it('returns all games ordered by title', async () => {
        await seedGames(db, 3);
        const all = await getAllGames(db);
        expect(all.map((g) => g.title)).toEqual(['Game 01', 'Game 02', 'Game 03']);
        expect(all[0].category).toEqual({ id: expect.any(Number), name: 'Strategy' });
        expect(all[0].publisher).toEqual({ id: expect.any(Number), name: 'Pub One' });
    });

    it('filters games by category', async () => {
        await seedFilteredGames(db);
        const filtered = await getGamesByFilter(db, { categoryIds: [1] });
        expect(filtered.map((game) => game.title)).toEqual(['Alpha', 'Bravo']);
    });

    it('filters games by publisher', async () => {
        await seedFilteredGames(db);
        const filtered = await getGamesByFilter(db, { publisherIds: [1] });
        expect(filtered.map((game) => game.title)).toEqual(['Alpha', 'Charlie']);
    });

    it('combines category and publisher filters', async () => {
        await seedFilteredGames(db);
        const filtered = await getGamesByFilter(db, { categoryIds: [1], publisherIds: [1] });
        expect(filtered.map((game) => game.title)).toEqual(['Alpha']);
    });

    it('returns an empty list when no matching games exist', async () => {
        await seedFilteredGames(db);
        const filtered = await getGamesByFilter(db, { categoryIds: [999], publisherIds: [999] });
        expect(filtered).toEqual([]);
    });

    it('returns all game ids ordered by title', async () => {
        await seedGames(db, 3);
        const ids = await getAllGameIds(db);
        const all = await getAllGames(db);
        expect(ids).toEqual(all.map((g) => g.id));
    });

    it('fetches a single game by id', async () => {
        await seedGames(db, 2);
        const ids = await getAllGameIds(db);
        const game = await getGameById(db, ids[0]);
        expect(game?.title).toBe('Game 01');
    });

    it('returns null for a non-existent game', async () => {
        await seedGames(db, 2);
        expect(await getGameById(db, 99999)).toBeNull();
    });
});
