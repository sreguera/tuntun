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

  return (
    <div className="App">
      <div>IPTR: <code>{tr.readIptr()}</code></div>
      <div>A: <code>{tr.top()}</code></div>
      <button onClick={() => step()}>Step</button>
      <button onClick={() => run()}>Run</button>
      <button onClick={() => reset()}>Reset</button>
    </div>
  );
}

export default App;
