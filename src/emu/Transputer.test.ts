import { MemStart, Transputer } from './Transputer';
import { asm } from '../asm/Assembler';

/**
 * Assembles the instructions in code and executes them. Stops after executing
 * as many steps as instructions. Do not use this for code with jumps!!!
 */
function execSeq(code: string): Transputer {
    const t = new Transputer();
    const codes = asm(code);
    t.bootFromLink(codes);
    codes.forEach(_ => t.step());
    return t;
}

/**
 * Assembles the instructions in code and executes them. Stops when a breakpoint
 * instruction is executed. Use this for code with jumps!!!
 */
function execCFlow(code: string): Transputer {
    const t = new Transputer();
    const codes = asm(code);
    t.bootFromLink(codes);
    t.run();
    return t;
}

test('boot from link with wptr at word offset 1', () => {
    const t = execSeq('ldlp 0');
    expect(t.top()).toBe(MemStart + 4);
});

test('boot from link with wptr at word offset 2', () => {
    const t = execSeq('ldc 0; ldlp 0');
    expect(t.top()).toBe(MemStart + 4);
});

test('boot from link with wptr at word offset 3', () => {
    const t = execSeq('ldc 0; ldc 0; ldlp 0');
    expect(t.top()).toBe(MemStart + 4);
});

test('boot from link with wptr at word offset 4', () => {
    const t = execSeq('ldc 0; ldc 0; ldc 0; ldlp 0');
    expect(t.top()).toBe(MemStart + 4);
});

test('ldc loads a constant', () => {
    const t = execSeq('ldc 3');
    expect(t.top()).toBe(0x3);
});

test('ldc loads a long constant', () => {
    const t = execSeq('ldc 0x345');
    expect(t.top()).toBe(0x345);
});

test('ldc loads a negative constant', () => {
    const t = execSeq('ldc -2');
    expect(t.top()).toBe(-2);
});

test('eqc produces true for equals', () => {
    const t = execSeq('ldc 3; eqc 3');
    expect(t.top()).toBe(1);
});

test('eqc produces false for not equals', () => {
    const t = execSeq('ldc 3; eqc 5');
    expect(t.top()).toBe(0);
});

test('rev reverses the stack', () => {
    const t = execSeq('ldc 3; ldc 4; rev');
    const a = t.pop();
    const b = t.pop();
    expect([a, b]).toEqual([3, 4]);
});

test('j jumps', () => {
    const t = execCFlow('j 2; ldc 3; j 0; ldc 5; j 0');
    expect(t.top()).toBe(5);
});

test('cj jumps if A is 0', () => {
    const t = execCFlow('ldc 0; cj 2; ldc 3; j 0; ldc 5; j 0');
    expect(t.top()).toBe(5);
});

test(`cj doesn't jump if A is not 0`, () => {
    const t = execCFlow('ldc 1; cj 2; ldc 3; j 0; ldc 5; j 0');
    expect(t.top()).toBe(3);
});

test('gcall jumps where A says', () => {
    const t = execCFlow(`ldc ${MemStart + 11}; gcall; ldc 3; j 0; ldc 5; j 0`);
    const a = t.pop();
    const b = t.pop();
    expect([a, b]).toEqual([5, MemStart + 9]);
});

test('gajw changes the workspace pointer', () => {
    const t = execSeq('ldc 0x100; gajw; ldlp 0');
    expect(t.top()).toBe(0x100);
});

test('ajw adjusts the workspace pointer', () => {
    const t = execSeq('ldc 256; gajw; ajw -4; ldlp 0');
    expect(t.top()).toBe(240);
});

test('call calls a procedure', () => {
    const base = MemStart + 0x100;
    const t = execCFlow(`ldc ${base}; gajw; ldc 9; call 2; ldc 3; j 0; ldl 1; j 0`);
    expect(t.top()).toBe(9);
});

test('ret returns from a procedure', () => {
    const base = MemStart + 0x100;
    const t = execCFlow(`ldc ${base}; gajw; call 2; ldlp 0; j 0; ldlp 0; ret`);
    const a = t.pop();
    const b = t.pop();
    expect([a, b]).toEqual([base, base - 16]);
});

test('ldl and stl load and set items in the workspace', () => {
    const t = execSeq(`ldc ${MemStart + 0x100}; gajw; ldc 7; stl 0; ldc 2; ldl 0`);
    expect(t.top()).toBe(7);
});

test('ldnlp computes a global address', () => {
    const t = execSeq('ldc 100; ldnlp 4');
    expect(t.top()).toBe(116);
});

test('ldnl and stnl load and set items globally', () => {
    const base = MemStart + 0x100;
    const t = execSeq(`ldc 7; ldc ${base}; stnl 5; ldc 0; ldc ${base}; ldnl 5`);
    expect(t.top()).toBe(7);
});

test('store and load of the status register works', () => {
    const t = execSeq('ldc 7; teststs; ldc 0; testlds');
    expect(t.top()).toBe(7);
});

test('store and load of the D register works', () => {
    const t = execSeq('ldc 7; teststd; ldc 0; testldd');
    expect(t.top()).toBe(7);
});

test('store and load of the E register works', () => {
    const t = execSeq('ldc 7; testste; ldc 0; testlde');
    expect(t.top()).toBe(7);
});

test('pop cycles the stack', () => {
    const t = execSeq('ldc 3; ldc 2; ldc 1; pop');
    const a = t.pop();
    const b = t.pop();
    const c = t.pop();
    expect([a, b, c]).toEqual([2, 3, 1]);
});

test('dup duplicates the top of the stack', () => {
    const t = execSeq('ldc 1; ldc 2; dup');
    const a = t.pop();
    const b = t.pop();
    const c = t.pop();
    expect([a, b, c]).toEqual([2, 2, 1]);
});

test('and performs a bitwise and', () => {
    const t = execSeq('ldc 0x0FF; ldc 0xFF0; and');
    expect(t.top()).toBe(0x0F0);
});

test('or performs a bitwise or', () => {
    const t = execSeq('ldc 0x0FF; ldc 0xFF0; or');
    expect(t.top()).toBe(0xFFF);
});

test('xor performs a bitwise xor', () => {
    const t = execSeq('ldc 0x0FF; ldc 0xFF0; xor');
    expect(t.top()).toBe(0xF0F);
});

test('sum performs an unchecked sum', () => {
    const t = execSeq('ldc -5; ldc 7; sum');
    expect(t.top()).toBe(2);
});

test('diff performs an unchecked difference', () => {
    const t = execSeq('ldc 5; ldc -7; diff');
    expect(t.top()).toBe(12);
});

test('prod performs an unchecked product', () => {
    const t = execSeq('ldc 0xFFFFFFFE; ldc 5; prod');
    expect(t.top()).toBe(-10);
});

test('not performs a bitwise not', () => {
    const t = execSeq('ldc 0xF; not');
    expect(t.top() >>> 0).toBe(0xFFFFFFF0);
});

test('testerr with no error puts true on the stack', () => {
    const t = execSeq('testerr');
    expect(t.top()).toBe(1);
});

test('testerr with error puts false on the stack', () => {
    const t = execSeq('seterr; testerr');
    expect(t.top()).toBe(0);
});

test('testerr clear the error flag', () => {
    const t = execSeq('seterr; testerr; testerr');
    expect(t.top()).toBe(1);
});

test('adc sums a constant to the top of the stack with no error', () => {
    const t = execSeq('ldc 4; adc 5; testerr');
    const a = t.pop();
    const b = t.pop();
    expect([a, b]).toEqual([1, 9]);
});

test('adc generates error on overflow', () => {
    const t = execSeq('ldc 0x7FFFFFFF; adc 1; testerr');
    expect(t.top()).toBe(0);
});

test('adc generates error on underflow', () => {
    const t = execSeq('ldc 0x80000000; adc -1; testerr');
    expect(t.top()).toBe(0);
});

test('gt is true when b > a', () => {
    const t = execSeq('ldc 4; ldc 2; gt');
    expect(t.top()).toBe(1);
});

test('gt is false when b <= a', () => {
    const t = execSeq('ldc 4; ldc 4; gt');
    expect(t.top()).toBe(0);
});

test('shl shifts left', () => {
    const t = execSeq('ldc 0x80000000; ldc 4; shl');
    expect(t.top()).toBe(0x08000000);
});

test('shl shifts right', () => {
    const t = execSeq('ldc 0xFF; ldc 4; shr');
    expect(t.top()).toBe(0xFF0);
});

test('mint produces the most negative int', () => {
    const t = execSeq('mint');
    expect(t.top()).toBe(-(2**31));
});

test('bcnt counts the number of bytes in words', () => {
    const t = execSeq('ldc 3; bcnt');
    expect(t.top()).toBe(12);
});

test('wcnt counts the number of words in bytes', () => {
    const t = execSeq('ldc 0xFF; wcnt');
    const a = t.pop();
    const b = t.pop();
    expect([a, b]).toEqual([0x3F, 0x3]);
});

test('bsub produces the byte index', () => {
    const t = execSeq('ldc 3; ldc 5; bsub');
    expect(t.top()).toBe(8);
});

test('wsub produces the word index', () => {
    const t = execSeq('ldc 3; ldc 5; wsub');
    expect(t.top()).toBe(17);
});

test('wsubdb produces the double word index', () => {
    const t = execSeq('ldc 3; ldc 5; wsubdb');
    expect(t.top()).toBe(29);
});

test('ldpi produces the byte index from the next inst', () => {
    const t = execSeq('ldc 5; ldpi');
    expect(t.top()).toBe(MemStart + 8);
});

test('sethalterr and clrhalterr effect can be seen with testhalterr', () => {
    const t = execSeq('sethalterr; testhalterr; clrhalterr; testhalterr');
    const a = t.pop();
    const b = t.pop();
    expect([a, b]).toEqual([0, 1]);
});

test('setj0break and clrj0break effect can be seen with testj0break', () => {
    const t = execSeq('setj0break; testj0break; clrj0break; testj0break');
    const a = t.pop();
    const b = t.pop();
    expect([a, b]).toEqual([0, 1]);
});

test('ldmemstarval produce the MemStart value', () => {
    const t = execSeq('ldmemstartval');
    expect(t.top() >>> 0).toBe(0x80000070);
});

test('lb and sb load and store bytes', () => {
    const addr = MemStart + 0x100;
    const t = execSeq(`ldc 5; ldc ${addr}; sb; ldc ${addr}; lb`);
    expect(t.top()).toBe(5);
});

test('ldpri produces the current priority', () => {
    const t = execSeq('ldpri');
    expect(t.top()).toBe(1);
});

test('sthf and sthb set the high priority regs and saveh stores them', () => {
    const addr = MemStart + 0x100;
    const t = execSeq(`ldc 5; sthf; ldc 7; sthb; ldc ${addr}; saveh; ldc ${addr}; ldnl 0; ldc ${addr}; ldnl 1;`);
    const a = t.pop();
    const b = t.pop();
    expect([a, b]).toEqual([7, 5]);
});

test('stlf and stlb set the low priority regs and savel stores them', () => {
    const addr = MemStart + 0x100;
    const t = execSeq(`ldc 5; stlf; ldc 7; stlb; ldc ${addr}; savel; ldc ${addr}; ldnl 0; ldc ${addr}; ldnl 1;`);
    const a = t.pop();
    const b = t.pop();
    expect([a, b]).toEqual([7, 5]);
});
