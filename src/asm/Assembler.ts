export function asm(code: string): number[] {
    const insts = code.split(';');
    return insts.flatMap(inst => asm1(inst));
}

interface InstructionDefinition {
    type: 'direct' | 'operation' | 'fpentry';
    code: number;
};

const PFIX = 0x2;
const LDC  = 0x4;
const NFIX = 0x6;
const OPR  = 0xF;
const FPENTRY = 0xAB;

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
        case 'fpentry': {
            return prefix(LDC, def.code).concat(prefix(OPR, FPENTRY));
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

const definitions: { [name: string]: InstructionDefinition } = {
    'j'             : { type: 'direct',    code: 0x0  },
    'ldlp'          : { type: 'direct',    code: 0x1  },
    'pfix'          : { type: 'direct',    code: PFIX },
    'ldnl'          : { type: 'direct',    code: 0x3  },
    'ldc'           : { type: 'direct',    code: LDC  },
    'ldnlp'         : { type: 'direct',    code: 0x5  },
    'nfix'          : { type: 'direct',    code: NFIX },
    'ldl'           : { type: 'direct',    code: 0x7  },
    'adc'           : { type: 'direct',    code: 0x8  },
    'call'          : { type: 'direct',    code: 0x9  },
    'cj'            : { type: 'direct',    code: 0xA  },
    'ajw'           : { type: 'direct',    code: 0xB  },
    'eqc'           : { type: 'direct',    code: 0xC  },
    'stl'           : { type: 'direct',    code: 0xD  },
    'stnl'          : { type: 'direct',    code: 0xE  },
    'opr'           : { type: 'direct',    code: 0xF  },
    'rev'           : { type: 'operation', code: 0x00 },
    'lb'            : { type: 'operation', code: 0x01 },
    'bsub'          : { type: 'operation', code: 0x02 },
    'endp'          : { type: 'operation', code: 0x03 },
    'diff'          : { type: 'operation', code: 0x04 },
    'add'           : { type: 'operation', code: 0x05 },
    'gcall'         : { type: 'operation', code: 0x06 },
    'in'            : { type: 'operation', code: 0x07 },
    'prod'          : { type: 'operation', code: 0x08 },
    'gt'            : { type: 'operation', code: 0x09 },
    'wsub'          : { type: 'operation', code: 0x0A },
    'out'           : { type: 'operation', code: 0x0B },
    'sub'           : { type: 'operation', code: 0x0C },
    'startp'        : { type: 'operation', code: 0x0D },
    'outbyte'       : { type: 'operation', code: 0x0E },
    'outword'       : { type: 'operation', code: 0x0F },
    'seterr'        : { type: 'operation', code: 0x10 },
    'resetch'       : { type: 'operation', code: 0x12 },
    'csub0'         : { type: 'operation', code: 0x13 },
    'stopp'         : { type: 'operation', code: 0x15 },
    'ladd'          : { type: 'operation', code: 0x16 },
    'stlb'          : { type: 'operation', code: 0x17 },
    'sthf'          : { type: 'operation', code: 0x18 },
    'norm'          : { type: 'operation', code: 0x19 },
    'ldiv'          : { type: 'operation', code: 0x1A },
    'ldpi'          : { type: 'operation', code: 0x1B },
    'stlf'          : { type: 'operation', code: 0x1C },
    'xdble'         : { type: 'operation', code: 0x1D },
    'ldpri'         : { type: 'operation', code: 0x1E },
    'rem'           : { type: 'operation', code: 0x1F },
    'ret'           : { type: 'operation', code: 0x20 },
    'lend'          : { type: 'operation', code: 0x21 },
    'ldtimer'       : { type: 'operation', code: 0x22 },
    'testlds'       : { type: 'operation', code: 0x23 },
    'testlde'       : { type: 'operation', code: 0x24 },
    'testldd'       : { type: 'operation', code: 0x25 },
    'teststs'       : { type: 'operation', code: 0x26 },
    'testste'       : { type: 'operation', code: 0x27 },
    'teststd'       : { type: 'operation', code: 0x28 },
    'testerr'       : { type: 'operation', code: 0x29 },
    'testpranal'    : { type: 'operation', code: 0x2A },
    'tin'           : { type: 'operation', code: 0x2B },
    'div'           : { type: 'operation', code: 0x2C },
    'testhardchan'  : { type: 'operation', code: 0x2D },
    'dist'          : { type: 'operation', code: 0x2E },
    'dics'          : { type: 'operation', code: 0x2F },
    'diss'          : { type: 'operation', code: 0x30 },
    'lmul'          : { type: 'operation', code: 0x31 },
    'not'           : { type: 'operation', code: 0x32 },
    'xor'           : { type: 'operation', code: 0x33 },
    'bcnt'          : { type: 'operation', code: 0x34 },
    'lshr'          : { type: 'operation', code: 0x35 },
    'lshl'          : { type: 'operation', code: 0x36 },
    'lsum'          : { type: 'operation', code: 0x37 },
    'lsub'          : { type: 'operation', code: 0x38 },
    'runp'          : { type: 'operation', code: 0x39 },
    'xword'         : { type: 'operation', code: 0x3A },
    'sb'            : { type: 'operation', code: 0x3B },
    'gajw'          : { type: 'operation', code: 0x3C },
    'savel'         : { type: 'operation', code: 0x3D },
    'saveh'         : { type: 'operation', code: 0x3E },
    'wcnt'          : { type: 'operation', code: 0x3F },
    'shl'           : { type: 'operation', code: 0x40 },
    'shr'           : { type: 'operation', code: 0x41 },
    'mint'          : { type: 'operation', code: 0x42 },
    'alt'           : { type: 'operation', code: 0x43 },
    'altwt'         : { type: 'operation', code: 0x44 },
    'altend'        : { type: 'operation', code: 0x45 },
    'and'           : { type: 'operation', code: 0x46 },
    'enbt'          : { type: 'operation', code: 0x47 },
    'enbc'          : { type: 'operation', code: 0x48 },
    'enbs'          : { type: 'operation', code: 0x49 },
    'move'          : { type: 'operation', code: 0x4A },
    'or'            : { type: 'operation', code: 0x4B },
    'csngl'         : { type: 'operation', code: 0x4C },
    'ccnt1'         : { type: 'operation', code: 0x4D },
    'talt'          : { type: 'operation', code: 0x4E },
    'ldiff'         : { type: 'operation', code: 0x4F },
    'sthb'          : { type: 'operation', code: 0x50 },
    'taltwt'        : { type: 'operation', code: 0x51 },
    'sum'           : { type: 'operation', code: 0x52 },
    'mul'           : { type: 'operation', code: 0x53 },
    'sttimer'       : { type: 'operation', code: 0x54 },
    'stoperr'       : { type: 'operation', code: 0x55 },
    'cword'         : { type: 'operation', code: 0x56 },
    'clrhalterr'    : { type: 'operation', code: 0x57 },
    'sethalterr'    : { type: 'operation', code: 0x58 },
    'testhalterr'   : { type: 'operation', code: 0x59 },
    'dup'           : { type: 'operation', code: 0x5A },
    'move2dinit'    : { type: 'operation', code: 0x5B },
    'move2dall'     : { type: 'operation', code: 0x5C },
    'move2dnonzero' : { type: 'operation', code: 0x5D },
    'move2dzero'    : { type: 'operation', code: 0x5E },
    'unpacksn'      : { type: 'operation', code: 0x63 },
    'postnormsn'    : { type: 'operation', code: 0x6C },
    'roundsn'       : { type: 'operation', code: 0x6D },
    'ldinf'         : { type: 'operation', code: 0x71 },
    'fmul'          : { type: 'operation', code: 0x72 },
    'cflerr'        : { type: 'operation', code: 0x73 },
    'crcword'       : { type: 'operation', code: 0x74 },
    'crcbyte'       : { type: 'operation', code: 0x75 },
    'bitcnt'        : { type: 'operation', code: 0x76 },
    'bitrevword'    : { type: 'operation', code: 0x77 },
    'bitrevnbits'   : { type: 'operation', code: 0x78 },
    'pop'           : { type: 'operation', code: 0x79 },
    'timerdisableh' : { type: 'operation', code: 0x7A },
    'timerdisablel' : { type: 'operation', code: 0x7B },
    'timerenableh'  : { type: 'operation', code: 0x7C },
    'timerenablel'  : { type: 'operation', code: 0x7D },
    'ldmemstartval' : { type: 'operation', code: 0x7E },
    'wsubdb'        : { type: 'operation', code: 0x81 },
    'fpldnldbi'     : { type: 'operation', code: 0x82 },
    'fpchkerr'      : { type: 'operation', code: 0x83 },
    'fpstnldb'      : { type: 'operation', code: 0x84 },
    'fpldnlsni'     : { type: 'operation', code: 0x86 },
    'fpadd'         : { type: 'operation', code: 0x87 },
    'fpstnlsn'      : { type: 'operation', code: 0x88 },
    'fpsub'         : { type: 'operation', code: 0x89 },
    'fpldnldb'      : { type: 'operation', code: 0x8A },
    'fpmul'         : { type: 'operation', code: 0x8B },
    'fpdiv'         : { type: 'operation', code: 0x8C },
    'fpldnlsn'      : { type: 'operation', code: 0x8E },
    'fpremfirst'    : { type: 'operation', code: 0x8F },
    'fpremstep'     : { type: 'operation', code: 0x90 },
    'fpnan'         : { type: 'operation', code: 0x91 },
    'fpordered'     : { type: 'operation', code: 0x92 },
    'fpnotfinite'   : { type: 'operation', code: 0x93 },
    'fpgt'          : { type: 'operation', code: 0x94 },
    'fpeq'          : { type: 'operation', code: 0x95 },
    'fpi32tor32'    : { type: 'operation', code: 0x96 },
    'fpi32tor64'    : { type: 'operation', code: 0x98 },
    'fpb32tor64'    : { type: 'operation', code: 0x9A },
    'fptesterr'     : { type: 'operation', code: 0x9C },
    'fprtoi32'      : { type: 'operation', code: 0x9D },
    'fpstnli32'     : { type: 'operation', code: 0x9E },
    'fpldzerosn'    : { type: 'operation', code: 0x9F },
    'fpldzerodb'    : { type: 'operation', code: 0xA0 },
    'fpint'         : { type: 'operation', code: 0xA1 },
    'fpdup'         : { type: 'operation', code: 0xA3 },
    'fprev'         : { type: 'operation', code: 0xA4 },
    'fpldnladddb'   : { type: 'operation', code: 0xA6 },
    'fpldnlmuldb'   : { type: 'operation', code: 0xA8 },
    'fpldnladdsn'   : { type: 'operation', code: 0xAA },
    'fpentry'       : { type: 'operation', code: FPENTRY },
    'fpldnlmulsn'   : { type: 'operation', code: 0xAC },
    'break'         : { type: 'operation', code: 0xB1 },
    'clrj0break'    : { type: 'operation', code: 0xB2 },
    'setj0break'    : { type: 'operation', code: 0xB3 },
    'testj0break'   : { type: 'operation', code: 0xB4 },
    'lddevid'       : { type: 'operation', code: 0x17C },
    'start'         : { type: 'operation', code: 0x1FF },
    'fpusqrtfirst'  : { type: 'fpentry',   code: 0x01 },
    'fpusqrtstep'   : { type: 'fpentry',   code: 0x02 },
    'fpusqrtlast'   : { type: 'fpentry',   code: 0x03 },
    'fpurp'         : { type: 'fpentry',   code: 0x04 },
    'fpurm'         : { type: 'fpentry',   code: 0x05 },
    'fpurz'         : { type: 'fpentry',   code: 0x06 },
    'fpur32tor64'   : { type: 'fpentry',   code: 0x07 },
    'fpur64tor32'   : { type: 'fpentry',   code: 0x08 },
    'fpuexpdec32'   : { type: 'fpentry',   code: 0x09 },
    'fpuexpinc32'   : { type: 'fpentry',   code: 0x0A },
    'fpuabs'        : { type: 'fpentry',   code: 0x0B },
    'fpunoround'    : { type: 'fpentry',   code: 0x0D },
    'fpuchki32'     : { type: 'fpentry',   code: 0x0E },
    'fpuchki64'     : { type: 'fpentry',   code: 0x0F },
    'fpudivby2'     : { type: 'fpentry',   code: 0x11 },
    'fpumulby2'     : { type: 'fpentry',   code: 0x12 },
    'fpurn'         : { type: 'fpentry',   code: 0x22 },
    'fpuseterr'     : { type: 'fpentry',   code: 0x23 },
    'fpuclrerr'     : { type: 'fpentry',   code: 0x9C },
};
