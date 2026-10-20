import { ModifiableValue } from '@/module/mods/ModifiableValue';

/** Initiative of a mode as the actor prepared it (system.initiative.meatspace / astral / matrix). */
interface PreparedMode {
    constant?: { value?: number };
    dice?: { changes?: { name: string }[] } & Record<string, unknown>;
}

/** The prepared initiative of an actor: its modes and whether Blitz is on (InitiativePrep). */
interface PreparedInitiative {
    blitz?: boolean;
    [mode: string]: PreparedMode | boolean | undefined;
}

/**
 * Initiative per perception mode, for showing every mode an actor could act in, not only the current one.
 * InitiativePrep prepares the dice of the current mode with what applies to it alone: Blitz (five dice, SR5#161)
 * and the hot sim die (4D6 against 3D6 in cold sim, SR5#266). Those are taken out of each mode's dice first, then
 * added back where they belong: the hot sim die to hot sim, Blitz to the mode in use.
 */
export const InitiativeRules = {
    /** Changes InitiativePrep adds for the current state only. */
    STATE_CHANGES: ['SR5.Blitz', 'SR5.HotSim'],

    /** The most Initiative Dice anyone rolls (SR5#161: Blitz rolls "the maximum of five"). */
    MAX_DICE: 5,

    /** The prepared mode a perception option rolls with: cold and hot sim are both the matrix initiative. */
    modeOf(option: string): string {
        return option.endsWith('_sim') ? 'matrix' : option;
    },

    /**
     * Initiative Dice of a perception option (meatspace, astral, cold_sim, hot_sim).
     * @param active the option is the one in use (Blitz applies to it only)
     */
    dice(initiative: PreparedInitiative, option: string, active: boolean): number {
        const mode = initiative[InitiativeRules.modeOf(option)] as PreparedMode | undefined;
        const copy = foundry.utils.deepClone(mode?.dice) as (PreparedMode['dice'] & { changes?: { name: string }[] }) | undefined;
        if (!copy) return 0;
        copy.changes = (copy.changes ?? []).filter(change => !InitiativeRules.STATE_CHANGES.includes(change.name));
        let count = ModifiableValue.calcTotal(copy as never, { min: 0, max: InitiativeRules.MAX_DICE });
        if (option === 'hot_sim') count = Math.min(InitiativeRules.MAX_DICE, count + 1);
        if (active && initiative.blitz) count = InitiativeRules.MAX_DICE;
        return count;
    },

    /**
     * Whose initiative a vehicle acts on, by its control mode (SR5#265). On autopilot, or with nobody at the
     * controls (the autopilot takes over, SR5#202), its own: Pilot × 2 + 4D6 (SR5#270). Jumped in, the rigger's VR
     * initiative (SR5#266, SR5#270). In manual and remote control the driver's actions move it (Control Device,
     * SR5#238), so the driver's own. The system rolls the vehicle's own in every mode (b155).
     */
    vehicleSource(controlMode: string, hasDriver: boolean): 'own' | 'rigger' | 'driver' {
        if (controlMode === 'autopilot' || !hasDriver) return 'own';
        return controlMode === 'rigger' ? 'rigger' : 'driver';
    },

    /** A prepared initiative as 'base+dice D6' ('6+4D6'). */
    prepared(initiative: { constant?: { value?: number }, dice?: { value?: number } } | undefined): string {
        return `${initiative?.constant?.value ?? 0}+${initiative?.dice?.value ?? 0}D6`;
    },

    /**
     * The initiative a vehicle acts on (vehicleSource): its own current one, the rigger's matrix (VR) one, or the
     * driver's current one.
     */
    vehicleFormula(source: 'own' | 'rigger' | 'driver', vehicle: { current?: object } | undefined, driver: { current?: object, matrix?: object } | undefined): string {
        const used = source === 'own' ? vehicle?.current : source === 'rigger' ? driver?.matrix : driver?.current;
        return InitiativeRules.prepared(used as never);
    },

    /** The initiative a perception option rolls, as 'base+dice D6' ('10+2D6'). */
    formula(initiative: PreparedInitiative, option: string, active: boolean): string {
        const mode = initiative[InitiativeRules.modeOf(option)] as PreparedMode | undefined;
        return `${mode?.constant?.value ?? 0}+${InitiativeRules.dice(initiative, option, active)}D6`;
    },
};
