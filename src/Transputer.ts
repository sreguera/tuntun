/** Offsets of registers in the register file. */
enum Regs { 
    /** Points to the workspace of the current process. */
    Wptr,
    /** Points to the next instruction to be executed. */
    Iptr,
    /** Top of the evaluation stack. */
    Areg,
    /** Middle of the evaluation stack. */
    Breg,
    /** Bottom of the evaluation stack. */
    Creg,
    /** Used internally by the microcode. */
    Dreg,
    /** Used internally by the microcode. */
    Ereg,
    /** Operand for the next instruction. */
    Oreg,
    /** Behaviour control and error information. */
    StatusReg,
    /** Marker to get the number of registers. */
    Eoreg
};

/** If set, halts processor when an error is generated. */
const HaltOnErrorFlag   = 0x00000080;
/** If set, executing j 0 causes a break.  */
const EnableJ0BreakFlag = 0x00000100;
/** Status bit set when there is an error. */
const ErrorFlag         = 0x80000000;

/** First user memory address. */
const MemStart = toInt32(0x80000070);

const MostNeg = toInt32(0x80000000);
const MostPos = toInt32(0x7FFFFFFF);
const BytesPerWord = 4;
const ByteSelectLength = 2;
const ByteSelectMask = 0x3;

const TRUE = 1;
const FALSE = 0;

class BreakpointReached {        
}

class IllegalInstruction {
}

class UnimplementedInstruction {
}

function toInt32(value: number): number {
    const a = new Int32Array(1);
    a[0] = value;
    return a[0];
}

export class Transputer {

    registers: Int32Array = new Int32Array(Regs.Eoreg);

    memory: DataView = new DataView(new ArrayBuffer(4096));

    constructor() {
        this.writeIptr(0);
    }

    /**
     * Executes instructions until a breakpoint instruction is reached.
     */
    run() {
        // TODO Implement haltonerrorflag behaviour
        // TODO Implement J 0 break behaviour

        try {
            while (true) {
                this.step();
            }    
        } catch (e: unknown) {
            if (!(e instanceof BreakpointReached)) {
                throw e;
            }
        }
    }

    /**
     * Executes one instruction.
     */
    step() {
        const inst = this.readByteMem(this.readIptr());
        this.writeOreg(this.readOreg() | (inst & 0xF));

        if (inst === 0x0) {
            throw new BreakpointReached();
        }

        this.direct[(inst & 0xF0) >>> 4].call(this);
    }

    readonly direct = [
        this.execJ,   this.execLdlp,  this.execPfix, this.execLdnl, // 0x0 - 0x3
        this.execLdc, this.execLdnlp, this.execNfix, this.execLdl,  // 0x4 - 0x7
        this.execAdc, this.execCall,  this.execCj,   this.execAjw,  // 0x8 - 0xB
        this.execEqc, this.execStl,   this.execStnl, this.execOpr,  // 0xC - 0xF
    ];

    execPfix() {
        this.writeOreg(this.readOreg() << 4);
        this.writeIptr(this.readIptr() + 1);
    }

    execNfix() {
        this.writeOreg((~this.readOreg()) << 4);
        this.writeIptr(this.readIptr() + 1);        
    }

    execLdc() {
        this.push(this.readOreg());
        this.writeOreg(0);
        this.writeIptr(this.nextInst());
    }

    execLdl() {
        this.push(this.readWorkspace(this.readOreg()));
        this.writeOreg(0);
        this.writeIptr(this.nextInst());
    }

    execStl() {
        this.writeWorkspace(this.readOreg(), this.pop());
        this.writeOreg(0);
        this.writeIptr(this.nextInst());
    }

    execLdlp() {
        this.push(this.index(this.readWptr(), this.readOreg()));
        this.writeOreg(0);
        this.writeIptr(this.nextInst());
    }

    execLdnl() {
        const a = this.pop() & ~ByteSelectMask;
        this.push(this.readMem(this.index(a, this.readOreg())));
        this.writeOreg(0);
        this.writeIptr(this.nextInst());
    }

    execStnl() {
        const a = this.pop() & ~ByteSelectMask;
        const b = this.pop();
        this.writeMem(this.index(a, this.readOreg()), b);
        this.writeOreg(0);
        this.writeIptr(this.nextInst());        
    }

    execLdnlp() {
        const a = this.pop() & ~ByteSelectMask;
        this.push(this.index(a, this.readOreg()));
        this.writeOreg(0);
        this.writeIptr(this.nextInst());        
    }

    execAjw() {
        this.writeWptr(this.index(this.readWptr(), this.readOreg()));
        this.writeOreg(0);
        this.writeIptr(this.nextInst());
    }

    execCall() {
        const a = this.pop();
        const b = this.pop();
        const c = this.pop();
        this.writeWptr(this.index(this.readWptr(), -4));
        this.writeWorkspace(0, this.nextInst());
        this.writeWorkspace(1, a);
        this.writeWorkspace(2, b);
        this.writeWorkspace(3, c);
        this.push(this.nextInst());
        this.writeIptr(this.byteIndex(this.nextInst(), this.readOreg()));
        this.writeOreg(0);
    }

    execEqc() {
        this.push(this.pop() === this.readOreg() ? TRUE : FALSE);
        this.writeOreg(0);
        this.writeIptr(this.nextInst());
    }

    execAdc() {
        const result = this.pop() + this.readOreg();
        if (result > MostPos || result < MostNeg) {
            this.setStatusFlag(ErrorFlag);
        }
        this.push(result);
        this.writeOreg(0);
        this.writeIptr(this.nextInst());
    }

    execJ() {
        this.writeIptr(this.byteIndex(this.nextInst(), this.readOreg()));
        this.writeOreg(0);
    }

    execCj() {
        if (this.top() === 0) {
            this.writeIptr(this.byteIndex(this.nextInst(), this.readOreg()));
        } else {
            this.pop();
            this.writeIptr(this.nextInst());
        }
        this.writeOreg(0);    
    }

    execOpr() {
        const opcode = this.readOreg();
        if (opcode < this.operations.length) {
            this.operations[this.readOreg()].call(this);
        } else if (opcode === 0x17F) {
            this.execLddevid();
        } else if (opcode === 0x1FF) {
            this.execStart();
        } else {
            throw new IllegalInstruction();
        }       
        this.writeOreg(0);
    }

    execIllegal() {
        throw new IllegalInstruction();
    }

    readonly operations = [
        this.execRev,           this.execLb,            this.execBsub,          this.execEndp,          // 0x00 - 0x03
        this.execDiff,          this.execAdd,           this.execGcall,         this.execIn,            // 0x04 - 0x07
        this.execProd,          this.execGt,            this.execWsub,          this.execOut,           // 0x08 - 0x0B
        this.execSub,           this.execStartp,        this.execOutbyte,       this.execOutword,       // 0x0C - 0x0F
        this.execSeterr,        this.execIllegal,       this.execResetch,       this.execCsub0,         // 0x10 - 0x13
        this.execIllegal,       this.execStopp,         this.execLadd,          this.execStlb,          // 0x14 - 0x17
        this.execSthf,          this.execNorm,          this.execLdiv,          this.execLdpi,          // 0x18 - 0x1B
        this.execStlf,          this.execXdble,         this.execLdpri,         this.execRem,           // 0x1C - 0x1F
        this.execRet,           this.execLend,          this.execLdtimer,       this.execTestlds,       // 0x20 - 0x23
        this.execTestlde,       this.execTestldd,       this.execTeststs,       this.execTestste,       // 0x24 - 0x27
        this.execTeststd,       this.execTesterr,       this.execTestpranal,    this.execTin,           // 0x28 - 0x2B
        this.execDiv,           this.execTesthardchan,  this.execDist,          this.execDisc,          // 0x2C - 0x2F
        this.execDiss,          this.execLmul,          this.execNot,           this.execXor,           // 0x30 - 0x33
        this.execBcnt,          this.execLshr,          this.execLshl,          this.execLsum,          // 0x34 - 0x37
        this.execLsub,          this.execRunp,          this.execXword,         this.execSb,            // 0x38 - 0x3B
        this.execGajw,          this.execSavel,         this.execSaveh,         this.execWcnt,          // 0x3C - 0x3F
        this.execShr,           this.execShl,           this.execMint,          this.execAlt,           // 0x40 - 0x43
        this.execAltwt,         this.execAltend,        this.execAnd,           this.execEnbt,          // 0x44 - 0x47
        this.execEnbc,          this.execEnbs,          this.execMove,          this.execOr,            // 0x48 - 0x4B
        this.execCsngl,         this.execCcnt1,         this.execTalt,          this.execLdiff,         // 0x4C - 0x4F
        this.execSthb,          this.execTaltwt,        this.execSum,           this.execMul,           // 0x50 - 0x53
        this.execSttimer,       this.execStoperr,       this.execCword,         this.execClrhalterr,    // 0x54 - 0x57
        this.execSethalterr,    this.execTesthalterr,   this.execDup,           this.execMove2dinit,    // 0x58 - 0x5B
        this.execMove2dall,     this.execMove2dnonzero, this.execMove2dzero,    this.execIllegal,       // 0x5C - 0x5F
        this.execIllegal,       this.execIllegal,       this.execIllegal,       this.execUnpacksn,      // 0x60 - 0x63
        this.execIllegal,       this.execIllegal,       this.execIllegal,       this.execIllegal,       // 0x64 - 0x67
        this.execIllegal,       this.execIllegal,       this.execIllegal,       this.execIllegal,       // 0x68 - 0x6B
        this.execPostnormsn,    this.execRoundsn,       this.execIllegal,       this.execIllegal,       // 0x6C - 0x6F
        this.execIllegal,       this.execLdinf,         this.execFmul,          this.execCflerr,        // 0x70 - 0x73
        this.execCrcword,       this.execCrcbyte,       this.execBitcnt,        this.execBitrevword,    // 0x74 - 0x77
        this.execBitrevnbits,   this.execPop,           this.execTimerdisableh, this.execTimerdisablel, // 0x78 - 0x7B
        this.execTimerenableh,  this.execTimerenablel,  this.execLdmemstartval, this.execIllegal,       // 0x7C - 0x7F
        this.execIllegal,       this.execWsubdb,        this.execFpldnldbi,     this.execFpchkerr,      // 0x80 - 0x83
        this.execFpstnldb,      this.execIllegal,       this.execFpldnlsni,     this.execFpadd,         // 0x84 - 0x87
        this.execFpstnlsn,      this.execFpsub,         this.execFpldnldb,      this.execFpmul,         // 0x88 - 0x8B
        this.execFpdiv,         this.execIllegal,       this.execFpldnlsn,      this.execFpremfirst,    // 0x8C - 0x8F
        this.execFpremstep,     this.execFpnan,         this.execFpordered,     this.execFpnonfinite,   // 0x90 - 0x93
        this.execFpgt,          this.execFpeq,          this.execFpi32tor32,    this.execIllegal,       // 0x94 - 0x97
        this.execFpi32tor64,    this.execIllegal,       this.execFpb32tor64,    this.execIllegal,       // 0x98 - 0x9B
        this.execFptesterr,     this.execFprtoi32,      this.execFpstnli32,     this.execFpldzerosn,    // 0x9C - 0x9F
        this.execFpldzerodb,    this.execFpint,         this.execIllegal,       this.execFpdup,         // 0xA0 - 0xA3
        this.execFprev,         this.execIllegal,       this.execFpldnladddb,   this.execIllegal,       // 0xA4 - 0xA7
        this.execFpldnlmuldb,   this.execIllegal,       this.execFpldnladdsn,   this.execFpentry,       // 0xA8 - 0xAB
        this.execFpldnlmulsn,   this.execIllegal,       this.execIllegal,       this.execIllegal,       // 0xAC - 0xAF
        this.execIllegal,       this.execBreak,         this.execClrj0break,    this.execSetj0break,    // 0xB0 - 0xB3
        this.execTestj0break,   this.execIllegal,       this.execIllegal,       this.execIllegal,       // 0xB4 - 0xB7
        this.execIllegal,       this.execIllegal,       this.execIllegal,       this.execIllegal,       // 0xB8 - 0xBB
        this.execIllegal,       this.execIllegal,       this.execIllegal,       this.execIllegal,       // 0xBC - 0xBF
    ];

    execRev() {
        const a = this.pop();
        const b = this.pop();
        this.push(a);
        this.push(b);
        this.writeIptr(this.nextInst());
    }

    execDup() {
        this.push(this.top());
        this.writeIptr(this.nextInst());
    }

    execPop() {
        this.pop();
        this.writeIptr(this.nextInst());
    }

    execAdd() {
        throw new UnimplementedInstruction();
    }

    execSub() {
        throw new UnimplementedInstruction();
    }

    execMul() {
        throw new UnimplementedInstruction();
    }

    execDiv() {
        throw new UnimplementedInstruction();
    }

    execRem() {
        throw new UnimplementedInstruction();
    }

    execSum() {
        throw new UnimplementedInstruction();
    }

    execDiff() {
        throw new UnimplementedInstruction();
    }

    execProd() {
        throw new UnimplementedInstruction();
    }

    execAnd() {
        const a = this.pop();
        const b = this.pop();
        this.push(a & b);
        this.writeIptr(this.nextInst());
    }

    execOr() {
        const a = this.pop();
        const b = this.pop();
        this.push(a | b);
        this.writeIptr(this.nextInst());
    }

    execXor() {
        const a = this.pop();
        const b = this.pop();
        this.push(a ^ b);
        this.writeIptr(this.nextInst());
    }

    execNot() {
        const a = this.pop();
        this.push(~a);
        this.writeIptr(this.nextInst());
    }

    execShl() {
        const a = this.pop();
        const b = this.pop();
        this.push(b << a);
        this.writeIptr(this.nextInst());
    }

    execShr() {
        const a = this.pop();
        const b = this.pop();
        this.push(b >>> a);
        this.writeIptr(this.nextInst());
    }

    execGt() {
        const a = this.pop();
        const b = this.pop();
        this.push(b > a ? TRUE : FALSE);
        this.writeIptr(this.nextInst());
    }

    execLend() {
        throw new UnimplementedInstruction();
    }

    execBcnt() {
        this.push(this.pop() * BytesPerWord);
        this.writeIptr(this.nextInst());
    }

    execWcnt() {
        const a = this.pop();
        this.push(a & ByteSelectMask);
        this.push(a >> ByteSelectLength);
        this.writeIptr(this.nextInst());
    }

    execLdpi() {
        this.push(this.byteIndex(this.nextInst(), this.pop()));
        this.writeIptr(this.nextInst());
    }

    execMint() {
        this.push(MostNeg);
        this.writeIptr(this.nextInst());
    }

    execBsub() {
        const a = this.pop();
        const b = this.pop();
        this.push(this.byteIndex(a, b));
        this.writeIptr(this.nextInst());
    }

    execWsub() {
        const a = this.pop();
        const b = this.pop();
        this.push(this.index(a, b));
        this.writeIptr(this.nextInst());
    }

    execWsubdb() {
        const a = this.pop();
        const b = this.pop();
        this.push(this.index(a, b * 2));
        this.writeIptr(this.nextInst());
    }

    execMove() {
        throw new UnimplementedInstruction();
    }

    execIn() {
        throw new UnimplementedInstruction();
    }

    execOut() {
        throw new UnimplementedInstruction();
    }

    execLb() {
        throw new UnimplementedInstruction();
    }

    execSb() {
        throw new UnimplementedInstruction();
    }

    execOutbyte() {
        throw new UnimplementedInstruction();
    }

    execOutword() {
        throw new UnimplementedInstruction();
    }

    execGcall() {
        const a = this.pop();
        this.push(this.nextInst());
        this.writeIptr(a);
    }

    execGajw() {
        const a = this.pop();
        this.push(this.readWptr());
        this.writeWptr(a & ~ByteSelectMask);
        this.writeIptr(this.nextInst());
    }

    execRet() {
        this.writeIptr(this.readWorkspace(0));
        this.writeWptr(this.index(this.readWptr(), 4));
    }

    execStartp() {
        throw new UnimplementedInstruction();
    }

    execEndp() {
        throw new UnimplementedInstruction();
    }

    execRunp() {
        throw new UnimplementedInstruction();
    }

    execStopp() {
        throw new UnimplementedInstruction();
    }

    execLdpri() {
        throw new UnimplementedInstruction();
    }

    execLdtimer() {
        throw new UnimplementedInstruction();
    }

    execTin() {
        throw new UnimplementedInstruction();
    }

    execAlt() {
        throw new UnimplementedInstruction();
    }

    execAltwt() {
        throw new UnimplementedInstruction();
    }

    execAltend() {
        throw new UnimplementedInstruction();
    }

    execTalt() {
        throw new UnimplementedInstruction();
    }

    execTaltwt() {
        throw new UnimplementedInstruction();
    }

    execEnbs() {
        throw new UnimplementedInstruction();
    }

    execDiss() {
        throw new UnimplementedInstruction();
    }

    execEnbc() {
        throw new UnimplementedInstruction();
    }

    execDisc() {
        throw new UnimplementedInstruction();
    }

    execEnbt() {
        throw new UnimplementedInstruction();
    }

    execDist() {
        throw new UnimplementedInstruction();
    }

    execCsub0() {
        throw new UnimplementedInstruction();
    }

    execCcnt1() {
        throw new UnimplementedInstruction();
    }

    execTesterr() {
        this.push(this.getStatusFlag(ErrorFlag) ? FALSE : TRUE);
        this.clearStatusFlag(ErrorFlag);
        this.writeIptr(this.nextInst());
    }

    execStoperr() {
        throw new UnimplementedInstruction();
    }

    execSeterr() {
        this.setStatusFlag(ErrorFlag);
        this.writeIptr(this.nextInst());
    }

    execXword() {
        throw new UnimplementedInstruction();
    }

    execCword() {
        throw new UnimplementedInstruction();
    }

    execXdble() {
        throw new UnimplementedInstruction();
    }

    execCsngl() {
        throw new UnimplementedInstruction();
    }

    execLadd() {
        throw new UnimplementedInstruction();
    }

    execLsub() {
        throw new UnimplementedInstruction();
    }

    execLsum() {
        throw new UnimplementedInstruction();
    }

    execLdiff() {
        throw new UnimplementedInstruction();
    }

    execLmul() {
        throw new UnimplementedInstruction();
    }

    execLdiv() {
        throw new UnimplementedInstruction();
    }

    execLshl() {
        throw new UnimplementedInstruction();
    }

    execLshr() {
        throw new UnimplementedInstruction();
    }

    execNorm() {
        throw new UnimplementedInstruction();
    }

    execResetch() {
        throw new UnimplementedInstruction();
    }

    execTestpranal() {
        throw new UnimplementedInstruction();
    }

    execSthf() {
        throw new UnimplementedInstruction();
    }

    execStlf() {
        throw new UnimplementedInstruction();
    }

    execSttimer() {
        throw new UnimplementedInstruction();
    }
  
    execSthb() {
        throw new UnimplementedInstruction();
    }

    execStlb() {
        throw new UnimplementedInstruction();
    }

    execSaveh() {
        throw new UnimplementedInstruction();
    }

    execSavel() {
        throw new UnimplementedInstruction();
    }

    execClrhalterr() {
        this.clearStatusFlag(HaltOnErrorFlag);
        this.writeIptr(this.nextInst());
    }

    execSethalterr() {
        this.setStatusFlag(HaltOnErrorFlag);
        this.writeIptr(this.nextInst());
    }

    execTesthalterr() {
        this.push(this.getStatusFlag(HaltOnErrorFlag) ? TRUE : FALSE);
        this.writeIptr(this.nextInst());
    }

    execTestlds() {
        this.push(this.readStatusReg());
        this.writeIptr(this.nextInst());
    }

    execTeststs() {
        this.writeStatusReg(this.pop());
        this.writeIptr(this.nextInst());
    }

    execTestldd() {
        this.push(this.readDreg());
        this.writeIptr(this.nextInst());
    }

    execTeststd() {
        this.writeDreg(this.pop());
        this.writeIptr(this.nextInst());
    }

    execTestlde() {
        this.push(this.readEreg());
        this.writeIptr(this.nextInst());
    }

    execTestste() {
        this.writeEreg(this.pop());
        this.writeIptr(this.nextInst());
    }

    execBreak() {
        throw new UnimplementedInstruction();
    }

    execClrj0break() {
        this.clearStatusFlag(EnableJ0BreakFlag);
        this.writeIptr(this.nextInst());
    }

    execSetj0break() {
        this.setStatusFlag(EnableJ0BreakFlag);
        this.writeIptr(this.nextInst());
    }

    execTestj0break() {
        this.push(this.getStatusFlag(EnableJ0BreakFlag) ? TRUE : FALSE);
        this.writeIptr(this.nextInst());
    }

    execTesthardchan() {
        throw new UnimplementedInstruction();
    }

    execTimerdisableh() {
        throw new UnimplementedInstruction();
    }

    execTimerdisablel() {
        throw new UnimplementedInstruction();
    }

    execTimerenableh() {
        throw new UnimplementedInstruction();
    }

    execTimerenablel() {
        throw new UnimplementedInstruction();
    }

    execLdmemstartval() {
        this.push(MemStart);
        this.writeIptr(this.nextInst());
    }

    execFmul() {
        throw new UnimplementedInstruction();
    }

    execUnpacksn() {
        throw new UnimplementedInstruction();
    }

    execRoundsn() {
        throw new UnimplementedInstruction();
    }

    execPostnormsn() {
        throw new UnimplementedInstruction();
    }

    execLdinf() {
        throw new UnimplementedInstruction();
    }

    execCflerr() {
        throw new UnimplementedInstruction();
    }

    execMove2dinit() {
        throw new UnimplementedInstruction();
    }

    execMove2dall() {
        throw new UnimplementedInstruction();
    }

    execMove2dnonzero() {
        throw new UnimplementedInstruction();
    }

    execMove2dzero() {
        throw new UnimplementedInstruction();
    }

    execCrcword() {
        throw new UnimplementedInstruction();
    }

    execCrcbyte() {
        throw new UnimplementedInstruction();
    }

    execBitcnt() {
        throw new UnimplementedInstruction();
    }
    execBitrevword() {
        throw new UnimplementedInstruction();
    }

    execBitrevnbits() {
        throw new UnimplementedInstruction();
    }

    execFpldnldbi() {
        throw new UnimplementedInstruction();
    }

    execFpchkerr() {
        throw new UnimplementedInstruction();
    }

    execFpstnldb() {
        throw new UnimplementedInstruction();
    }

    execFpldnlsni() {
        throw new UnimplementedInstruction();
    }     

    execFpadd() {
        throw new UnimplementedInstruction();
    }

    execFpstnlsn() {
        throw new UnimplementedInstruction();
    }      

    execFpsub() {
        throw new UnimplementedInstruction();
    }         

    execFpldnldb() {
        throw new UnimplementedInstruction();
    }     

    execFpmul() {
        throw new UnimplementedInstruction();
    }

    execFpdiv() {
        throw new UnimplementedInstruction();
    }         

    execFpldnlsn() {
        throw new UnimplementedInstruction();
    }      

    execFpremfirst() {
        throw new UnimplementedInstruction();
    }

    execFpremstep() {
        throw new UnimplementedInstruction();
    }     

    execFpnan() {
        throw new UnimplementedInstruction();
    }         

    execFpordered() {
        throw new UnimplementedInstruction();
    }     

    execFpnonfinite() {
        throw new UnimplementedInstruction();
    }

    execFpgt() {
        throw new UnimplementedInstruction();
    }          

    execFpeq() {
        throw new UnimplementedInstruction();
    }          

    execFpi32tor32() {
        throw new UnimplementedInstruction();
    }

    execFpi32tor64() {
        throw new UnimplementedInstruction();
    }    

    execFpb32tor64() {
        throw new UnimplementedInstruction();
    }    

    execFptesterr() {
        throw new UnimplementedInstruction();
    }     

    execFprtoi32() {
        throw new UnimplementedInstruction();
    }      

    execFpstnli32() {
        throw new UnimplementedInstruction();
    }     

    execFpldzerosn() {
        throw new UnimplementedInstruction();
    }

    execFpldzerodb() {
        throw new UnimplementedInstruction();
    }    

    execFpint() {
        throw new UnimplementedInstruction();
    }         

    execFpdup() {
        throw new UnimplementedInstruction();
    }

    execFprev() {
        throw new UnimplementedInstruction();
    }         

    execFpldnladddb() {
        throw new UnimplementedInstruction();
    }   

    execFpldnlmuldb() {
        throw new UnimplementedInstruction();
    }   

    execFpldnladdsn() {
        throw new UnimplementedInstruction();
    }   

    execFpentry() {
        throw new UnimplementedInstruction();
    }

    execFpldnlmulsn() {
        throw new UnimplementedInstruction();
    }

    execLddevid() {
        throw new UnimplementedInstruction();
    }

    execStart() {
        throw new UnimplementedInstruction();
    }

    /** Returns the address of the next instruction. */
    nextInst(): number {
        return this.registers[Regs.Iptr] + 1;
    }

    readIptr(): number {
        return this.registers[Regs.Iptr];
    }

    writeIptr(value: number) {
        this.registers[Regs.Iptr] = value;
    }

    readWptr(): number {
        return this.registers[Regs.Wptr];
    }

    writeWptr(value: number) {
        this.registers[Regs.Wptr] = value;
    }

    readOreg(): number {
        return this.registers[Regs.Oreg];
    }

    writeOreg(value: number) {
        this.registers[Regs.Oreg] = value;
    }

    readDreg(): number {
        return this.registers[Regs.Dreg];
    }

    writeDreg(value: number) {
        this.registers[Regs.Dreg] = value;
    }

    readEreg(): number {
        return this.registers[Regs.Ereg];
    }

    writeEreg(value: number) {
        this.registers[Regs.Ereg] = value;
    }

    readStatusReg(): number {
        return this.registers[Regs.StatusReg];
    }

    writeStatusReg(value: number) {
        this.registers[Regs.StatusReg] = value;
    }

    setStatusFlag(flag: number) {
        this.writeStatusReg(this.readStatusReg() | flag);
    }

    clearStatusFlag(flag: number) {
        this.writeStatusReg(this.readStatusReg() & ~flag);
    }

    getStatusFlag(flag: number): boolean {
        return (this.readStatusReg() & flag) !== 0;
    }

    push(value: number) {
        this.registers[Regs.Creg] = this.registers[Regs.Breg];
        this.registers[Regs.Breg] = this.registers[Regs.Areg];
        this.registers[Regs.Areg] = value;
    }

    pop(): number {
        const value = this.registers[Regs.Areg];
        this.registers[Regs.Areg] = this.registers[Regs.Breg];
        this.registers[Regs.Breg] = this.registers[Regs.Creg];
        this.registers[Regs.Creg] = value;
        return value;
    }

    top(): number {
        return this.registers[Regs.Areg];
    }

    index(base: number, offset: number): number {
        return base + (BytesPerWord * offset);
    }

    byteIndex(base: number, offset: number): number {
        return base + offset;
    }

    readByteMem(offset: number): number {
        return this.memory.getUint8(offset);
    }

    writeByteMem(offset: number, value: number) {
        return this.memory.setUint8(offset, value);
    }

    readMem(offset: number): number {
        return this.memory.getInt32(offset, true);
    }

    writeMem(offset: number, value: number) {
        return this.memory.setInt32(offset, value, true);
    }

    readWorkspace(offset: number): number {
        return this.readMem(this.index(this.readWptr(), offset));
    }

    writeWorkspace(offset: number, value: number) {
        return this.writeMem(this.index(this.readWptr(), offset), value);
    }

}