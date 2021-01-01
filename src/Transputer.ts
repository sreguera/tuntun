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

const MostNeg = 0x80000000;
const MostPos = 0x7FFFFFFF;

const TRUE = 1;
const FALSE = 0;

class BreakpointReached {        
}

export class Transputer {

    registers: Int32Array = new Int32Array(Regs.Eoreg);

    memory: Uint8Array = new Uint8Array(4096);

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
                break;
            }
            case 0x2: {
                this.execPfix();
                break;
            }
            case 0x3: {
                break;
            }
            case 0x4: {
                this.execLdc();
                break;
            }
            case 0x5: {
                break;
            }
            case 0x6: {
                this.execNfix();
                break;
            }
            case 0x7: {
                break;
            }
            case 0x8: {
                break;
            }
            case 0x9: {
                break;
            }
            case 0xA: {
                this.execCj();
                break;
            }
            case 0xB: {
                break;
            }
            case 0xC: {
                this.execEqc();
                break;
            }
            case 0xD: {
                break;
            }
            case 0xE: {
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

    execEqc() {
        this.push(this.pop() === this.readOreg() ? TRUE : FALSE);
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
            case 0x32: {
                this.execNot();
                break;
            }
            case 0x33: {
                this.execXor();
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

    byteIndex(base: number, offset: number): number {
        return base + offset;
    }

    readByteMem(offset: number): number {
        return this.memory[offset];
    }

    writeByteMem(offset: number, value: number) {
        return this.memory[offset] = value;
    }
}