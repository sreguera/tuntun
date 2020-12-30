export {};

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
        default: {
            return [];
        }
    }
}

const PFIX = 0x2;
const NFIX = 0x6;
const LDC = 0x4;

function prefix(op: number, e: number): number[] {
    if (e < 16 && e >= 0) {
        return [ (op << 4) | e ];
    } else if (e >= 16) {
        return prefix(PFIX, e >> 4).concat([ (op << 4) | (e & 0xF) ]);
    } else  /* if (e < 0) */ {
        return prefix(NFIX, ~e >> 4).concat([ (op << 4) | (e & 0xF) ]);
    }
}