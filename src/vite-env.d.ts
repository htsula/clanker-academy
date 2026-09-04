/// <reference types="vite/client" />

declare module '*.png?arraybuffer' {
  const content: ArrayBuffer
  export default content
}