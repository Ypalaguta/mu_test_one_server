import type { Repository, StatsResponse } from '../../shared/contracts.js';
import { ApiError, found } from '../../http/errors.js';
export async function characterStats(repository: Repository, id: number): Promise<StatsResponse> {
  const character = found(await repository.character(id));
  const definition = await repository.characterClass(character.info.classId);
  if (!definition) throw new ApiError(409, 'CLASS_NOT_FOUND', 'Character references a missing class');
  return { baseStats: definition.baseStats, growthStats: definition.growthStats };
}
