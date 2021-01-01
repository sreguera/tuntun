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
        case 'j': {
            return prefix(J, parseInt(fields[1]));
        }
        case 'cj': {
            return prefix(CJ, parseInt(fields[1]));
        }
        case 'rev': {
            return prefix(OPR, REV);
        }
        case 'testlds': {
            return prefix(OPR, TESTLDS);
        }
        case 'teststs': {
            return prefix(OPR, TESTSTS);
        }
        case 'testldd': {
            return prefix(OPR, TESTLDD);
        }
        case 'teststd': {
            return prefix(OPR, TESTSTD);
        }
        case 'testlde': {
            return prefix(OPR, TESTLDE);
        }
        case 'testste': {
            return prefix(OPR, TESTSTE);
        }
        default: {
            return [];
        }
    }
}

const J    = 0x0;
const PFIX = 0x2;
const LDC  = 0x4;
const NFIX = 0x6;
const CJ   = 0xA;
const EQC  = 0xC;
const OPR  = 0xF;

const REV     = 0x00;
const TESTLDS = 0x23;
const TESTLDE = 0x24;
const TESTLDD = 0x25;
const TESTSTS = 0x26;
const TESTSTE = 0x27;
const TESTSTD = 0x28;

function prefix(op: number, e: number): number[] {
    if (e < 16 && e >= 0) {
        return [ (op << 4) | e ];
    } else if (e >= 16) {
        return prefix(PFIX, e >> 4).concat([ (op << 4) | (e & 0xF) ]);
    } else  /* if (e < 0) */ {
        return prefix(NFIX, ~e >> 4).concat([ (op << 4) | (e & 0xF) ]);
    }
}