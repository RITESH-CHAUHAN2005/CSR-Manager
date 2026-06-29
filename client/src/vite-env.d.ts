/// <reference types="vite/client" />

// Select2 ships no types; its CommonJS export is an installer function.
declare module 'select2' {
  const select2: (root?: unknown, jquery?: unknown) => unknown
  export default select2
}
