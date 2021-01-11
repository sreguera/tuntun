import React, { useReducer, useState } from 'react';

import { Transputer } from './emu/Transputer';
import { asm } from './asm/Assembler';

const p = asm('ldc 5; ldc 8; sum');
const t = new Transputer();
t.bootFromLink(p);

function App() {

  const [tr, setTr] = useState(t);
  const [ignored, forceUpdate] = useReducer(x => x + 1, 0);

  function step() {
    tr.step();
    forceUpdate();
  };

  function run() {
    tr.run();
    forceUpdate();
  };

  function reset() {
    tr.bootFromLink(p);
    forceUpdate();
  };

  function wordToStr(value: number): string {
    const s = (value >>> 0).toString(16);
    return '00000000'.substr(0, 8 - s.length) + s;
  }

  return (
    <div className="App">
      <div>WPTR: <code>{wordToStr(tr.readWptr())}</code></div>
      <div>IPTR: <code>{wordToStr(tr.readIptr())}</code></div>
      <div>O: <code>{wordToStr(tr.readOreg())}</code></div>
      <div>A: <code>{wordToStr(tr.readAreg())}</code></div>
      <div>B: <code>{wordToStr(tr.readBreg())}</code></div>
      <div>C: <code>{wordToStr(tr.readCreg())}</code></div>
      <div>Priority: <code>{tr.readPri() === 0 ? "High" : "Low"}</code></div>
      <button onClick={() => step()}>Step</button>
      <button onClick={() => run()}>Run</button>
      <button onClick={() => reset()}>Reset</button>
    </div>
  );
}

export default App;
