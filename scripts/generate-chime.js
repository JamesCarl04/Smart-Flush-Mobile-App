const fs = require('fs');
const path = require('path');

const sampleRate = 44100;
const duration = 0.35; // 350ms
const numSamples = Math.floor(sampleRate * duration);
const numChannels = 1;
const bitsPerSample = 16;
const bytesPerSample = bitsPerSample / 8;
const blockAlign = numChannels * bytesPerSample;
const byteRate = sampleRate * blockAlign;
const dataSize = numSamples * blockAlign;
const headerSize = 44;
const totalSize = headerSize + dataSize;

const buffer = Buffer.alloc(totalSize);

// RIFF chunk descriptor
buffer.write('RIFF', 0);
buffer.writeUInt32LE(totalSize - 8, 4);
buffer.write('WAVE', 8);

// fmt sub-chunk
buffer.write('fmt ', 12);
buffer.writeUInt32LE(16, 16); // SubChunk1Size (16 for PCM)
buffer.writeUInt16LE(1, 20); // AudioFormat (1 for PCM)
buffer.writeUInt16LE(numChannels, 22); // NumChannels
buffer.writeUInt32LE(sampleRate, 24); // SampleRate
buffer.writeUInt32LE(byteRate, 28); // ByteRate
buffer.writeUInt16LE(blockAlign, 32); // BlockAlign
buffer.writeUInt16LE(bitsPerSample, 34); // BitsPerSample

// data sub-chunk
buffer.write('data', 36);
buffer.writeUInt32LE(dataSize, 40);

// Generate PCM audio samples
// Two-tone chime: 1046.5Hz (C6) for first 120ms, then 1567.98Hz (G6) for remainder
const splitTime = 0.12;

for (let i = 0; i < numSamples; i++) {
  const t = i / sampleRate;
  let sampleValue = 0;

  if (t < splitTime) {
    const freq = 1046.5;
    const attack = Math.min(1, t / 0.005);
    const decay = Math.exp(-t * 6);
    sampleValue = Math.sin(2 * Math.PI * freq * t) * attack * decay;
  } else {
    const tRel = t - splitTime;
    const freq = 1567.98;
    const attack = Math.min(1, tRel / 0.005);
    const decay = Math.exp(-tRel * 10);
    sampleValue = Math.sin(2 * Math.PI * freq * tRel) * attack * decay;
  }

  // 16-bit signed PCM
  const intVal = Math.max(-32768, Math.min(32767, Math.floor(sampleValue * 28000)));
  buffer.writeInt16LE(intVal, 44 + i * 2);
}

const outDir = path.join(__dirname, '..', 'assets', 'sounds');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}
const outPath = path.join(outDir, 'task-complete.wav');
fs.writeFileSync(outPath, buffer);
console.log('Saved', outPath, 'Bytes:', buffer.length);
