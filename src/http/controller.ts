import type { RequestHandler } from 'express';
import type { Repository } from '../shared/contracts.js';
import { skillResponse } from '../modules/skills/service.js';
import { characterStats } from '../modules/characters/service.js';
import { parseActionBarSlots } from '../modules/action-bar/service.js';
import { ApiError, found, parseId } from './errors.js';

function withErrorLogging(
    name: string,
    handler: RequestHandler
): RequestHandler {
    return async (req, res, next) => {
        try {
            await handler(req, res, next);
        } catch (error) {
            console.error(`[${name}] ERROR`, {
                method: req.method,
                path: req.originalUrl,
                params: req.params,
                error
            });

            next(error);
        }
    };
}

export function createController(repo: Repository) {
    const characterInfo = withErrorLogging('characterInfo', async (req, res) => {
        const id = parseId(req.params.id);

        console.log(`characterInfo ${id}`);

        const doc = found(await repo.character(id));

        res.json({
            id: doc.id,
            ...doc.info
        });
    });

    const getCharacterStats = withErrorLogging('getCharacterStats', async (req, res) => {
        const id = parseId(req.params.id);

        console.log(`getCharacterStats ${id}`);

        res.json(await characterStats(repo, id));
    });

    const characterActionBar = withErrorLogging('characterActionBar', async (req, res) => {
        const id = parseId(req.params.id);

        console.log(`characterActionBar ${id}`);

        const doc = found(await repo.actionBar(id));

        res.json({
            // Existing character documents created before this feature may not have the field yet.
            slots: doc.actionBarSlots ?? []
        });
    });

    const saveCharacterActionBar = withErrorLogging('saveCharacterActionBar', async (req, res) => {
        const id = parseId(req.params.id);
        const slots = parseActionBarSlots(req.body);

        console.log(`saveCharacterActionBar ${id}`);

        const doc = found(await repo.saveActionBar(id, slots));

        res.json({
            slots: doc.actionBarSlots
        });
    });

    const monsterInfo = withErrorLogging('monsterInfo', async (req, res) => {
        const id = parseId(req.params.id);

        console.log(`monsterInfo ${id}`);

        const doc = found(await repo.monster(id));

        res.json({
            id: doc.id,
            ...doc.info
        });
    });

    const monsterStats = withErrorLogging('monsterStats', async (req, res) => {
        const id = parseId(req.params.id);

        console.log(`monsterStats ${id}`);

        const doc = found(await repo.monster(id));

        res.json({
            baseStats: doc.baseStats,
            growthStats: doc.growthStats
        });
    });

    const monsterSpawns = withErrorLogging('monsterSpawns', async (req, res) => {
        const locationId = req.params.locationId;

        console.log(`monsterSpawns ${locationId}`);

        if (
            typeof locationId !== 'string' ||
            !/^[a-zA-Z0-9_-]{1,64}$/.test(locationId)
        ) {
            throw new ApiError(
                400,
                'INVALID_LOCATION',
                'Invalid locationId'
            );
        }

        const location = found(await repo.location(locationId));

        res.json({
            camps: location.camps
        });
    });

    const item = withErrorLogging('item', async (req, res) => {
        const id = parseId(req.params.id);

        console.log(`item ${id}`);

        const d = found(await repo.item(id));

        res.json({ id: d.id, name: d.name, type: d.type, slot: d.slot, requirements: d.requirements,
            stats: d.stats, description: d.description, iconName: d.iconName, executionId: d.executionId,
            inventoryTab: d.inventoryTab, maxStack: d.maxStack });
    });

    const skills = withErrorLogging('skills', async (_req, res) => {
        res.json((await repo.skills()).map(skillResponse));
    });

    const skill = withErrorLogging('skill', async (req, res) => {
        const id = parseId(req.params.id);

        console.log(`skill ${id}`);

        const d = found(await repo.skill(id));

        res.json(skillResponse(d));
    });

    const characterClass = withErrorLogging('characterClass', async (req, res) => {
        const id = parseId(req.params.id);

        console.log(`characterClass ${id}`);

        const d = found(await repo.characterClass(id));

        res.json({
            id: d.id,
            name: d.name,
            baseStats: d.baseStats,
            growthStats: d.growthStats,
            skillIds: d.skillIds
        });
    });

    return {
        characterInfo,
        characterStats: getCharacterStats,
        characterActionBar,
        saveCharacterActionBar,
        monsterInfo,
        monsterStats,
        monsterSpawns,
        item,
        skill,
        skills,
        characterClass
    };
}
