declare module 'next-pwa' {
  type NextPWAOptions = Record<string, unknown>;
  type ConfigFn = <T>(config: T) => T;
  function withPWA(options: NextPWAOptions): ConfigFn;
  export default withPWA;
}
