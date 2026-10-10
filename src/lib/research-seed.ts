import type { Exercise } from "./types";
import metadata from "../data/exercise-research.json" with { type: "json" };
import { researchSchema } from "./training-research-validation";
export function seedResearch(e: Exercise): Exercise {
  const research = (metadata.exercises as Record<string, object>)[e.id];
  return research
    ? {
        ...e,
        research: researchSchema.parse({ ...metadata.defaults, ...research }),
      }
    : e;
}
