export class Memory {

    readonly base: number;
    readonly memory: DataView;

    constructor(base: number, size: number) {
        this.base = base;
        this.memory = new DataView(new ArrayBuffer(size));
    }

    readByte(offset: number): number {
        return this.memory.getUint8(offset - this.base);
    }

    writeByte(offset: number, value: number) {
        return this.memory.setUint8(offset - this.base, value);
    }

    readWord(offset: number): number {
        return this.memory.getInt32(offset - this.base, true);
    }

    writeWord(offset: number, value: number) {
        return this.memory.setInt32(offset - this.base, value, true);
    }

}