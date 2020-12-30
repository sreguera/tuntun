import { Transputer } from './Transputer'

test('ldc loads a constant', () => {
    const t = new Transputer();
    t.writeByteMem(0, 0x43);
    t.step();
    expect(t.top()).toBe(0x3);
});

test('ldc loads a long constant', () => {
    const t = new Transputer();
    t.writeByteMem(0, 0x23);
    t.writeByteMem(1, 0x24);
    t.writeByteMem(2, 0x45);
    t.step();
    t.step();
    t.step();
    expect(t.top()).toBe(0x345);
});

test('ldc loads a negative constant', () => {
    const t = new Transputer();
    t.writeByteMem(0, 0x60);
    t.writeByteMem(1, 0x4E);
    t.step();
    t.step();
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