export function asm(code: string): number[] {
    const insts = code.split(';');
    return insts.flatMap(inst => asm1(inst));
}

interface InstructionDefinition {
    type: 'direct' | 'operation';
    code: number;
};

const PFIX = 0x2;
const NFIX = 0x6;
const OPR  = 0xF;

const definitions: { [name: string]: InstructionDefinition } = {
    'j'       : { type: 'direct',    code: 0x0  },
    'pfix'    : { type: 'direct',    code: PFIX },
    'ldc'     : { type: 'direct',    code: 0x4  },
    'nfix'    : { type: 'direct',    code: NFIX },
    'cj'      : { type: 'direct',    code: 0xA  },
    'eqc'     : { type: 'direct',    code: 0xC  },
    'rev'     : { type: 'operation', code: 0x00 },
    'testlds' : { type: 'operation', code: 0x23 },
    'testlde' : { type: 'operation', code: 0x24 },
    'testldd' : { type: 'operation', code: 0x25 },
    'teststs' : { type: 'operation', code: 0x26 },
    'testste' : { type: 'operation', code: 0x27 },
    'teststd' : { type: 'operation', code: 0x28 },
    'not'     : { type: 'operation', code: 0x32 },
    'xor'     : { type: 'operation', code: 0x33 },
    'and'     : { type: 'operation', code: 0x46 },
    'or'      : { type: 'operation', code: 0x4B },
    'dup'     : { type: 'operation', code: 0x5A },
    'pop'     : { type: 'operation', code: 0x79 },
};

function asm1(inst: string): number[] {
    const fields = inst.trim().split(' ');
    const def = definitions[fields[0]];
    if (!def)
    {
        return [];
    }

    switch (def.type) {
        case 'direct': {
            return prefix(def.code, parseInt(fields[1]));
        }
        case 'operation': {
            return prefix(OPR, def.code);
        }
    }
}

function prefix(op: number, e: number): number[] {
    if (e < 16 && e >= 0) {
        return [ (op << 4) | e ];
    } else if (e >= 16) {
        return prefix(PFIX, e >> 4).concat([ (op << 4) | (e & 0xF) ]);
    } else  /* if (e < 0) */ {
        return prefix(NFIX, ~e >> 4).concat([ (op << 4) | (e & 0xF) ]);
    }
}