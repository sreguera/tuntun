class FpIllegalInstruction {
}

class FpUnimplementedInstruction {
}

enum RoundMode {
    ToNearest,
    ToZero,
    ToPlusInfinity,
    ToMinusInfinity
}

export class Fpu {

    roundMode: RoundMode = RoundMode.ToNearest;

    fpErrorFlag: boolean = false;

    execIllegal() {
        throw new FpIllegalInstruction();
    }

    execFpldnldbi() {
        this.roundMode = RoundMode.ToNearest;
        throw new FpUnimplementedInstruction();
    }

    execFpchkerr() {
        this.roundMode = RoundMode.ToNearest;
        throw new FpUnimplementedInstruction();
    }

    execFpstnldb() {
        this.roundMode = RoundMode.ToNearest;
        throw new FpUnimplementedInstruction();
    }

    execFpldnlsni() {
        this.roundMode = RoundMode.ToNearest;
        throw new FpUnimplementedInstruction();
    }     

    execFpadd() {
        this.roundMode = RoundMode.ToNearest;
        throw new FpUnimplementedInstruction();
    }

    execFpstnlsn() {
        this.roundMode = RoundMode.ToNearest;
        throw new FpUnimplementedInstruction();
    }      

    execFpsub() {
        this.roundMode = RoundMode.ToNearest;
        throw new FpUnimplementedInstruction();
    }         

    execFpldnldb() {
        this.roundMode = RoundMode.ToNearest;
        throw new FpUnimplementedInstruction();
    }     

    execFpmul() {
        this.roundMode = RoundMode.ToNearest;
        throw new FpUnimplementedInstruction();
    }

    execFpdiv() {
        this.roundMode = RoundMode.ToNearest;
        throw new FpUnimplementedInstruction();
    }         

    execFpldnlsn() {
        this.roundMode = RoundMode.ToNearest;
        throw new FpUnimplementedInstruction();
    }      

    execFpremfirst() {
        this.roundMode = RoundMode.ToNearest;
        throw new FpUnimplementedInstruction();
    }

    execFpremstep() {
        this.roundMode = RoundMode.ToNearest;
        throw new FpUnimplementedInstruction();
    }     

    execFpnan() {
        this.roundMode = RoundMode.ToNearest;
        throw new FpUnimplementedInstruction();
    }         

    execFpordered() {
        this.roundMode = RoundMode.ToNearest;
        throw new FpUnimplementedInstruction();
    }     

    execFpnonfinite() {
        this.roundMode = RoundMode.ToNearest;
        throw new FpUnimplementedInstruction();
    }

    execFpgt() {
        this.roundMode = RoundMode.ToNearest;
        throw new FpUnimplementedInstruction();
    }          

    execFpeq() {
        this.roundMode = RoundMode.ToNearest;
        throw new FpUnimplementedInstruction();
    }          

    execFpi32tor32() {
        this.roundMode = RoundMode.ToNearest;
        throw new FpUnimplementedInstruction();
    }

    execFpi32tor64() {
        this.roundMode = RoundMode.ToNearest;
        throw new FpUnimplementedInstruction();
    }    

    execFpb32tor64() {
        this.roundMode = RoundMode.ToNearest;
        throw new FpUnimplementedInstruction();
    }    

    execFptesterr() {
        this.roundMode = RoundMode.ToNearest;
        throw new FpUnimplementedInstruction();
    }     

    execFprtoi32() {
        this.roundMode = RoundMode.ToNearest;
        throw new FpUnimplementedInstruction();
    }      

    execFpstnli32() {
        this.roundMode = RoundMode.ToNearest;
        throw new FpUnimplementedInstruction();
    }     

    execFpldzerosn() {
        this.roundMode = RoundMode.ToNearest;
        throw new FpUnimplementedInstruction();
    }

    execFpldzerodb() {
        this.roundMode = RoundMode.ToNearest;
        throw new FpUnimplementedInstruction();
    }    

    execFpint() {
        this.roundMode = RoundMode.ToNearest;
        throw new FpUnimplementedInstruction();
    }         

    execFpdup() {
        this.roundMode = RoundMode.ToNearest;
        throw new FpUnimplementedInstruction();
    }

    execFprev() {
        this.roundMode = RoundMode.ToNearest;
        throw new FpUnimplementedInstruction();
    }         

    execFpldnladddb() {
        this.roundMode = RoundMode.ToNearest;
        throw new FpUnimplementedInstruction();
    }   

    execFpldnlmuldb() {
        this.roundMode = RoundMode.ToNearest;
        throw new FpUnimplementedInstruction();
    }   

    execFpldnladdsn() {
        this.roundMode = RoundMode.ToNearest;
        throw new FpUnimplementedInstruction();
    }   

    execFpentry(opcode: number) {
        if (opcode < this.entries.length) {
            this.entries[opcode].call(this);
        } else if (opcode === 0x9C) {
            this.execFpuclrerr();
        } else {
            throw new FpIllegalInstruction();
        }       
    }

    execFpldnlmulsn() {
        this.roundMode = RoundMode.ToNearest;
        throw new FpUnimplementedInstruction();
    }

    readonly entries = [
        this.execIllegal,       this.execFpusqrfirst,   this.execFpusqrstep,    this.execFpusqrlast,    // 0x00 - 0x03
        this.execFpurp,         this.execFpurm,         this.execFpurz,         this.execFpur32tor64,   // 0x04 - 0x07
        this.execFpur64tor32,   this.execFpuexpdec32,   this.execFpuexpinc32,   this.execFpuabs,        // 0x08 - 0x0B
        this.execIllegal,       this.execFpunoround,    this.execFpuchki32,     this.execFpuchki64,     // 0x0C - 0x0F
        this.execIllegal,       this.execFpudivby2,     this.execFpumulby2,     this.execIllegal,       // 0x10 - 0x13
        this.execIllegal,       this.execIllegal,       this.execIllegal,       this.execIllegal,       // 0x14 - 0x17
        this.execIllegal,       this.execIllegal,       this.execIllegal,       this.execIllegal,       // 0x18 - 0x1B
        this.execIllegal,       this.execIllegal,       this.execIllegal,       this.execIllegal,       // 0x1C - 0x1F
        this.execIllegal,       this.execIllegal,       this.execFpurn,         this.execFpuseterr,     // 0x20 - 0x23
        this.execIllegal,       this.execIllegal,       this.execIllegal,       this.execIllegal,       // 0x24 - 0x27
        this.execIllegal,       this.execIllegal,       this.execIllegal,       this.execIllegal,       // 0x28 - 0x2B
        this.execIllegal,       this.execIllegal,       this.execIllegal,       this.execIllegal,       // 0x2C - 0x2F
    ];

    execFpusqrfirst() {
        this.roundMode = RoundMode.ToNearest;
        throw new FpUnimplementedInstruction();
    }

    execFpusqrstep() {
        this.roundMode = RoundMode.ToNearest;
        throw new FpUnimplementedInstruction();
    }

    execFpusqrlast() {
        this.roundMode = RoundMode.ToNearest;
        throw new FpUnimplementedInstruction();
    }

    execFpurn() {
        this.roundMode = RoundMode.ToNearest;
    }

    execFpurp() {
        this.roundMode = RoundMode.ToPlusInfinity;
    }

    execFpurm() {
        this.roundMode = RoundMode.ToMinusInfinity;
    }

    execFpurz() {
        this.roundMode = RoundMode.ToZero;
    }

    execFpur32tor64() {
        this.roundMode = RoundMode.ToNearest;
        throw new FpUnimplementedInstruction();
    }

    execFpur64tor32() {
        this.roundMode = RoundMode.ToNearest;
        throw new FpUnimplementedInstruction();
    }

    execFpuexpdec32() {
        this.roundMode = RoundMode.ToNearest;
        throw new FpUnimplementedInstruction();
    }

    execFpuexpinc32() {
        this.roundMode = RoundMode.ToNearest;
        throw new FpUnimplementedInstruction();
    }

    execFpuabs() {
        this.roundMode = RoundMode.ToNearest;
        throw new FpUnimplementedInstruction();
    }

    execFpunoround() {
        this.roundMode = RoundMode.ToNearest;
        throw new FpUnimplementedInstruction();
    }

    execFpuchki32() {
        this.roundMode = RoundMode.ToNearest;
        throw new FpUnimplementedInstruction();
    }

    execFpuchki64() {
        this.roundMode = RoundMode.ToNearest;
        throw new FpUnimplementedInstruction();
    }

    execFpudivby2() {
        this.roundMode = RoundMode.ToNearest;
        throw new FpUnimplementedInstruction();
    }

    execFpumulby2() {
        this.roundMode = RoundMode.ToNearest;
        throw new FpUnimplementedInstruction();
    }

    execFpuseterr() {
        this.fpErrorFlag = true;
        this.roundMode = RoundMode.ToNearest;
    }

    execFpuclrerr() {
        this.fpErrorFlag = false;
        this.roundMode = RoundMode.ToNearest;
    }

}