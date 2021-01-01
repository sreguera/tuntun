import { Transputer } from './Transputer';
import { asm } from './Assembler';

/**
 * Assembles the instructions in code and executes them. Stops after executing
 * as many steps as instructions. Do not use this for code with jumps!!!
 */
function execSeq(code: string, t: Transputer) {
    const codes = asm(code);
    codes.forEach((val, offset) => {
        t.writeByteMem(offset, val);
    });
    codes.forEach(_ => t.step());
}

/**
 * Assembles the instructions in code and executes them. Stops when a breakpoint
 * instruction is executed. Use this for code with jumps!!!
 */
function execCFlow(code: string, t: Transputer) {
    const codes = asm(code);
    codes.forEach((val, offset) => {
        t.writeByteMem(offset, val);
    });
    t.run();
}

test('ldc loads a constant', () => {
    const t = new Transputer();
    execSeq('ldc 3', t);
    expect(t.top()).toBe(0x3);
});

test('ldc loads a long constant', () => {
    const t = new Transputer();
    execSeq('ldc 0x345', t);
    expect(t.top()).toBe(0x345);
});

test('ldc loads a negative constant', () => {
    const t = new Transputer();
    execSeq('ldc -2', t);
    expect(t.top()).toBe(-2);
});

test('eqc produces true for equals', () => {
    const t = new Transputer();
    execSeq('ldc 3; eqc 3', t);
    expect(t.top()).toBe(1);
});

test('eqc produces false for not equals', () => {
    const t = new Transputer();
    execSeq('ldc 3; eqc 5', t);
    expect(t.top()).toBe(0);
});

test('rev reverses the stack', () => {
    const t = new Transputer();
    execSeq('ldc 3; ldc 4; rev', t);
    const a = t.pop();
    const b = t.pop();
    expect([a, b]).toEqual([3, 4]);
});

test('j jumps', () => {
    const t = new Transputer();
    execCFlow('j 1; ldc 3; ldc 5; j 0', t);
    expect(t.top()).toBe(5);
});

test('cj jumps if A is 0', () => {
    const t = new Transputer();
    execCFlow('ldc 0; cj 2; ldc 3; j 0; ldc 5; j 0', t);
    expect(t.top()).toBe(5);
});

test(`cj doesn't jump if A is not 0`, () => {
    const t = new Transputer();
    execCFlow('ldc 1; cj 2; ldc 3; j 0; ldc 5; j 0', t);
    expect(t.top()).toBe(3);
});

test('store and load of the status register works', () => {
    const t = new Transputer();
    execSeq('ldc 7; teststs; ldc 0; testlds', t);
    expect(t.top()).toBe(7);
});

test('store and load of the D register works', () => {
    const t = new Transputer();
    execSeq('ldc 7; teststd; ldc 0; testldd', t);
    expect(t.top()).toBe(7);
});

test('store and load of the E register works', () => {
    const t = new Transputer();
    execSeq('ldc 7; testste; ldc 0; testlde', t);
    expect(t.top()).toBe(7);
});
