export function asm(code: string): number[] {
    const insts = code.split(';');
    return insts.flatMap(inst => asm1(inst));
}

function asm1(inst: string): number[] {
    const fields = inst.trim().split(' ');
    switch (fields[0]) {
        case 'ldc': {
            return prefix(LDC, parseInt(fields[1]));
        }
        case 'eqc': {
            return prefix(EQC, parseInt(fields[1]));
        }
        case 'rev': {
            return prefix(OPR, REV);
        }
        default: {
            return [];
        }
    }
}

const PFIX = 0x2;
const NFIX = 0x6;
const LDC = 0x4;
const EQC = 0xC;
const OPR = 0xF;

const REV = 0x0;

function prefix(op: number, e: number): number[] {
    if (e < 16 && e >= 0) {
        return [ (op << 4) | e ];
    } else if (e >= 16) {
        return prefix(PFIX, e >> 4).concat([ (op << 4) | (e & 0xF) ]);
    } else  /* if (e < 0) */ {
        return prefix(NFIX, ~e >> 4).concat([ (op << 4) | (e & 0xF) ]);
    }
}