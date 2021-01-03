import { isThisTypeNode } from "typescript";

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

/** Status bit set when there is an error. */
const ErrorFlag = 0x80000000;

const MostNeg = -0x80000000;
const MostPos = 0x7FFFFFFF;
const BytesPerWord = 4;
const ByteSelectLength = 2;
const ByteSelectMask = 0x3;

const TRUE = 1;
const FALSE = 0;

class BreakpointReached {        
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

        switch ((inst & 0xF0) >>> 4) {
            case 0x0: {
                this.execJ();
                break;
            }
            case 0x1: {
                this.execLdlp();
                break;
            }
            case 0x2: {
                this.execPfix();
                break;
            }
            case 0x3: {
                this.execLdnl();
                break;
            }
            case 0x4: {
                this.execLdc();
                break;
            }
            case 0x5: {
                this.execLdnlp();
                break;
            }
            case 0x6: {
                this.execNfix();
                break;
            }
            case 0x7: {
                this.execLdl();
                break;
            }
            case 0x8: {
                this.execAdc();
                break;
            }
            case 0x9: {
                this.execCall();
                break;
            }
            case 0xA: {
                this.execCj();
                break;
            }
            case 0xB: {
                this.execAjw();
                break;
            }
            case 0xC: {
                this.execEqc();
                break;
            }
            case 0xD: {
                this.execStl();
                break;
            }
            case 0xE: {
                this.execStnl();
                break;
            }
            case 0xF: {
                this.execOpr();
                break;
            }
        }
    }

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
        switch (this.readOreg()) {
            case 0x0: {
                this.execRev();
                break;
            }
            case 0x2: {
                this.execBsub();
                break;
            }
            case 0x6: {
                this.execGcall();
                break;
            }
            case 0x09: {
                this.execGt();
                break;
            }
            case 0xA: {
                this.execWsub();
                break;
            }
            case 0x10: {
                this.execSeterr();
                break;
            }
            case 0x1B: {
                this.execLdpi();
                break;
            }
            case 0x20: {
                this.execRet();
                break;
            }
            case 0x23: {
                this.execTestlds();
                break;
            }
            case 0x24: {
                this.execTestlde();
                break;
            }
            case 0x25: {
                this.execTestldd();
                break;
            }
            case 0x26: {
                this.execTeststs();
                break;
            }
            case 0x27: {
                this.execTestste();
                break;
            }
            case 0x28: {
                this.execTeststd();
                break;
            }
            case 0x29: {
                this.execTesterr();
                break;
            }
            case 0x32: {
                this.execNot();
                break;
            }
            case 0x33: {
                this.execXor();
                break;
            }
            case 0x34: {
                this.execBcnt();
                break;
            }
            case 0x3C: {
                this.execGajw();
                break;
            }
            case 0x3F: {
                this.execWcnt();
                break;
            }
            case 0x40: {
                this.execShr();
                break;
            }
            case 0x41: {
                this.execShl();
                break;
            }
            case 0x42: {
                this.execMint();
                break;
            }
            case 0x46: {
                this.execAnd();
                break;
            }
            case 0x4B: {
                this.execOr();
                break;
            }
            case 0x5A: {
                this.execDup();
                break;
            }
            case 0x79: {
                this.execPop();
                break;
            }
            case 0x81: {
                this.execWsubdb();
                break;
            }
        }
        this.writeOreg(0);
    }

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

    execSeterr() {
        this.setStatusFlag(ErrorFlag);
        this.writeIptr(this.nextInst());
    }

    execTesterr() {
        this.push(this.getStatusFlag(ErrorFlag) ? FALSE : TRUE);
        this.clearStatusFlag(ErrorFlag);
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
        return (this.readStatusReg() & ErrorFlag) !== 0;
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