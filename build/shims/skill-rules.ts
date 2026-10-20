// The system's SkillRules plus the dice pool rule the redesign added to the fork.
import { SkillRules as SystemSkillRules } from 'stock/module/rules/SkillRules';

export class SkillRules extends SystemSkillRules {
    /** Dice pool of a skill with its linked attribute, or null when it cannot be rolled (untrained, no defaulting). */
    static pool(skill: any, attribute: number): number | null {
        if (!SystemSkillRules.allowRoll(skill)) return null;
        return Math.max(0, SystemSkillRules.level(skill) + attribute);
    }
}
