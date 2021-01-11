import { Fpu } from "./Fpu";
import { Memory } from "./Memory";

/** Offsets of registers in the register file. */
enum Regs { 
    /** Contains the the workspace and priority of the current process. */
    WdescReg,
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
    /** Front of high priority active process list. */
    FPtrReg0,
    /** Front of low priority active process list. */
    FPtrReg1,
    /** Back of high priority active process list. */
    BPtrReg0,
    /** Back of low priority active process list. */
    BPtrReg1,
    /** High priority processor clock. */
    ClockReg0,
    /** Low priority processor clock. */
    ClockReg1,
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
export const MemStart = toInt32(0x80000070);

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

function adjustToNextWord(value: number): number {
    if ((value & ByteSelectMask) === 0) {
        return value;
    } else {
        return (value + BytesPerWord) & ~ByteSelectMask; 
    }
}

export class Transputer {

    registers: Int32Array = new Int32Array(Regs.Eoreg);

    memory: Memory = new Memory(MostNeg, 4096);

    fpu: Fpu = new Fpu();

    bootFromLink(code: number[]) {
        code.forEach((val, offset) => {
            this.writeByteMem(offset + MemStart, val);
        });
        this.writeIptr(MemStart);
        this.writeWdescReg(adjustToNextWord(MemStart + code.length) | 1);
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
            this.operations[opcode].call(this);
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
        const a = this.pop();
        const b = this.pop();
        this.push(a + b);
        this.writeIptr(this.nextInst());
    }

    execDiff() {
        const a = this.pop();
        const b = this.pop();
        this.push(b - a);
        this.writeIptr(this.nextInst());
    }

    execProd() {
        const a = this.pop();
        const b = this.pop();
        this.push(Math.imul(b, a));
        this.writeIptr(this.nextInst());
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
        const a = this.pop();
        this.push(this.readByteMem(a));
        this.writeIptr(this.nextInst());
    }

    execSb() {
        const a = this.pop();
        const b = this.pop();
        this.writeByteMem(a, b);
        this.writeIptr(this.nextInst());
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
        this.push(this.readPri());
        this.writeIptr(this.nextInst());
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
        this.writeFPtrReg0(this.pop());
        this.writeIptr(this.nextInst());
    }

    execStlf() {
        this.writeFPtrReg1(this.pop());
        this.writeIptr(this.nextInst());
    }

    execSttimer() {
        throw new UnimplementedInstruction();
    }
  
    execSthb() {
        this.writeBPtrReg0(this.pop());
        this.writeIptr(this.nextInst());
    }

    execStlb() {
        this.writeBPtrReg1(this.pop());
        this.writeIptr(this.nextInst());
    }

    execSaveh() {
        const a = this.pop();
        this.writeMem(this.index(a, 0), this.readFPtrReg0());
        this.writeMem(this.index(a, 1), this.readBPtrReg0());
        this.writeIptr(this.nextInst());
    }

    execSavel() {
        const a = this.pop();
        this.writeMem(this.index(a, 0), this.readFPtrReg1());
        this.writeMem(this.index(a, 1), this.readBPtrReg1());
        this.writeIptr(this.nextInst());
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

    execFpldnlsn() {
        this.fpu.execFpldnlsn();
        this.writeIptr(this.nextInst());
        throw new UnimplementedInstruction();
    }      

    execFpldnldb() {
        this.fpu.execFpldnldb();
        this.writeIptr(this.nextInst());
        throw new UnimplementedInstruction();
    }     

    execFpldnlsni() {
        this.fpu.execFpldnlsni();
        this.writeIptr(this.nextInst());
        throw new UnimplementedInstruction();
    }     

    execFpldnldbi() {
        this.fpu.execFpldnldbi();
        this.writeIptr(this.nextInst());
        throw new UnimplementedInstruction();
    }

    execFpldnladdsn() {
        this.fpu.execFpldnladdsn();
        this.writeIptr(this.nextInst());
        throw new UnimplementedInstruction();
    }   

    execFpldnladddb() {
        this.fpu.execFpldnladddb();
        this.writeIptr(this.nextInst());
        throw new UnimplementedInstruction();
    }   

    execFpldnlmulsn() {
        this.fpu.execFpldnlmulsn();
        this.writeIptr(this.nextInst());
        throw new UnimplementedInstruction();
    }

    execFpldnlmuldb() {
        this.fpu.execFpldnlmuldb();
        this.writeIptr(this.nextInst());
        throw new UnimplementedInstruction();
    }   

    execFpstnlsn() {
        this.fpu.execFpstnlsn();
        this.writeIptr(this.nextInst());
        throw new UnimplementedInstruction();
    }      

    execFpstnldb() {
        this.fpu.execFpstnldb();
        this.writeIptr(this.nextInst());
        throw new UnimplementedInstruction();
    }

    execFpstnli32() {
        this.fpu.execFpstnli32();
        this.writeIptr(this.nextInst());
        throw new UnimplementedInstruction();
    }     

    execFpadd() {
        this.fpu.execFpadd();
        this.writeIptr(this.nextInst());
    }

    execFpsub() {
        this.fpu.execFpsub();
        this.writeIptr(this.nextInst());
    }         

    execFpmul() {
        this.fpu.execFpmul();
        this.writeIptr(this.nextInst());
    }

    execFpdiv() {
        this.fpu.execFpdiv();
        this.writeIptr(this.nextInst());
    }         

    execFpremfirst() {
        this.fpu.execFpremfirst();
        this.writeIptr(this.nextInst());
        throw new UnimplementedInstruction();
    }

    execFpremstep() {
        this.fpu.execFpremstep();
        this.writeIptr(this.nextInst());
        throw new UnimplementedInstruction();
    }     

    execFpnan() {
        this.fpu.execFpnan();
        this.writeIptr(this.nextInst());
        throw new UnimplementedInstruction();
    }         

    execFpordered() {
        this.fpu.execFpordered();
        this.writeIptr(this.nextInst());
        throw new UnimplementedInstruction();
    }     

    execFpnonfinite() {
        this.fpu.execFpnonfinite();
        this.writeIptr(this.nextInst());
        throw new UnimplementedInstruction();
    }

    execFpgt() {
        this.fpu.execFpgt();
        this.writeIptr(this.nextInst());
        throw new UnimplementedInstruction();
    }          

    execFpeq() {
        this.fpu.execFpeq();
        this.writeIptr(this.nextInst());
        throw new UnimplementedInstruction();
    }          

    execFpi32tor32() {
        this.fpu.execFpi32tor32();
        this.writeIptr(this.nextInst());
        throw new UnimplementedInstruction();
    }

    execFpi32tor64() {
        this.fpu.execFpi32tor64();
        this.writeIptr(this.nextInst());
        throw new UnimplementedInstruction();
    }    

    execFpb32tor64() {
        this.fpu.execFpb32tor64();
        this.writeIptr(this.nextInst());
        throw new UnimplementedInstruction();
    }    

    execFpchkerr() {
        this.fpu.execFpchkerr();
        this.writeIptr(this.nextInst());
        throw new UnimplementedInstruction();
    }

    execFptesterr() {
        this.fpu.execFptesterr();
        this.writeIptr(this.nextInst());
        throw new UnimplementedInstruction();
    }     

    execFprtoi32() {
        this.fpu.execFprtoi32();
        this.writeIptr(this.nextInst());
        throw new UnimplementedInstruction();
    }      

    execFpldzerosn() {
        this.fpu.execFpldzerosn();
        this.writeIptr(this.nextInst());
    }

    execFpldzerodb() {
        this.fpu.execFpldzerodb();
        this.writeIptr(this.nextInst());
    }    

    execFpint() {
        this.fpu.execFpint();
        this.writeIptr(this.nextInst());
        throw new UnimplementedInstruction();
    }         

    execFpdup() {
        this.fpu.execFpdup();
        this.writeIptr(this.nextInst());
    }

    execFprev() {
        this.fpu.execFprev();
        this.writeIptr(this.nextInst());
    }         

    execFpentry() {
        this.fpu.execFpentry(this.pop());
        this.writeIptr(this.nextInst());
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

    writeWdescReg(value: number) {
        this.registers[Regs.WdescReg] = value;
    }

    readWptr(): number {
        return this.registers[Regs.WdescReg] & -2;
    }

    writeWptr(value: number) {
        this.registers[Regs.WdescReg] = (value & -2) | this.readPri();
    }

    readPri(): number {
        return this.registers[Regs.WdescReg] & 1;
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

    readFPtrReg0(): number {
        return this.registers[Regs.FPtrReg0];
    }

    writeFPtrReg0(value: number) {
        this.registers[Regs.FPtrReg0] = value;
    }

    readFPtrReg1(): number {
        return this.registers[Regs.FPtrReg1];
    }

    writeFPtrReg1(value: number) {
        this.registers[Regs.FPtrReg1] = value;
    }

    readBPtrReg0(): number {
        return this.registers[Regs.BPtrReg0];
    }

    writeBPtrReg0(value: number) {
        this.registers[Regs.BPtrReg0] = value;
    }

    readBPtrReg1(): number {
        return this.registers[Regs.BPtrReg1];
    }

    writeBPtrReg1(value: number) {
        this.registers[Regs.BPtrReg1] = value;
    }

    readClockReg0(): number {
        return this.registers[Regs.ClockReg0];
    }

    writeClockReg0(value: number) {
        this.registers[Regs.ClockReg0] = value;
    }
    
    readClockReg1(): number {
        return this.registers[Regs.ClockReg1];
    }

    writeClockReg1(value: number) {
        this.registers[Regs.ClockReg1] = value;
    }

    readAreg(): number {
        return this.registers[Regs.Areg];
    }

    writeAreg(value: number) {
        this.registers[Regs.Areg] = value;
    }

    readBreg(): number {
        return this.registers[Regs.Breg];
    }

    writeBreg(value: number) {
        this.registers[Regs.Breg] = value;
    }

    readCreg(): number {
        return this.registers[Regs.Creg];
    }

    writeCreg(value: number) {
        this.registers[Regs.Creg] = value;
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
        return this.memory.readByte(offset);
    }

    writeByteMem(offset: number, value: number) {
        return this.memory.writeByte(offset, value);
    }

    readMem(offset: number): number {
        return this.memory.readWord(offset);
    }

    writeMem(offset: number, value: number) {
        return this.memory.writeWord(offset, value);
    }

    readWorkspace(offset: number): number {
        return this.readMem(this.index(this.readWptr(), offset));
    }

    writeWorkspace(offset: number, value: number) {
        return this.writeMem(this.index(this.readWptr(), offset), value);
    }

}