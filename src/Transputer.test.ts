import { Transputer } from './Transputer';
import { asm } from './Assembler';

function execSeq(code: string, t: Transputer) {
    const codes = asm(code);
    codes.forEach((val, offset) => {
        t.writeByteMem(offset, val);
    });
    codes.forEach(_ => t.step());
}

test('ldc loads a constant', () => {
    const t = new Transputer();
    execSeq("ldc 3", t);
    expect(t.top()).toBe(0x3);
});

test('ldc loads a long constant', () => {
    const t = new Transputer();
    execSeq("ldc 0x345", t);
    expect(t.top()).toBe(0x345);
});

test('ldc loads a negative constant', () => {
    const t = new Transputer();
    execSeq("ldc -2", t);
    expect(t.top()).toBe(-2);
});

test('eqc produces true for equals', () => {
    const t = new Transputer();
    t.writeByteMem(0, 0x43);
    t.writeByteMem(1, 0xC3);
    t.step();
    t.step();
    expect(t.top()).toBe(1);
});

test('eqc produces false for not equals', () => {
    const t = new Transputer();
    t.writeByteMem(0, 0x43);
    t.writeByteMem(1, 0xC5);
    t.step();
    t.step();
    expect(t.top()).toBe(0);
});

test('rev reverses the stack', () => {
    const t = new Transputer();
    t.writeByteMem(0, 0x43);
    t.writeByteMem(1, 0x44);
    t.writeByteMem(2, 0xF0);
    t.step();
    t.step();
    t.step();
    const a = t.pop();
    const b = t.pop();
    expect([a, b]).toEqual([3, 4]);
});