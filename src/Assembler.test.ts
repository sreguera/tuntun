import { asm } from './Assembler';

test('assembles a 1 byte inst', () => {
    const bytes = asm('ldc 3');
    expect(bytes).toEqual([0x43]);
});

test('assembles a multi-byte inst', () => {
    const bytes = asm('ldc 0x345');
    expect(bytes).toEqual([0x23, 0x24, 0x45]);
});

test('assembles a negative arg', () => {
    const bytes = asm('ldc -2');
    expect(bytes).toEqual([0x60, 0x4E]);
});

test('assembles more than 1 inst', () => {
    const bytes = asm('ldc 3; ldc 4');
    expect(bytes).toEqual([0x43, 0x44]);
});

test('assembles a simple operation', () => {
    const bytes = asm('rev');
    expect(bytes).toEqual([0xF0]);
})

test('assembles a complex operation', () => {
    const bytes = asm('div');
    expect(bytes).toEqual([0x22, 0xFC]);
})

test('assembles a super-complex operation', () => {
    const bytes = asm('start');
    expect(bytes).toEqual([0x21, 0x2F, 0xFF]);
})

test('assembles a fpentry operation', () => {
    const bytes = asm('fpudivby2');
    expect(bytes).toEqual([0x21, 0x41, 0x2A, 0xFB]);
})
