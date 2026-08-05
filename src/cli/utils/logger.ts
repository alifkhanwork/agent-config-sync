import pc from 'picocolors';

export const logger = {
  info: (msg: string) => console.log(`${pc.blue('ℹ')} ${msg}`),
  success: (msg: string) => console.log(`${pc.green('✔')} ${msg}`),
  warn: (msg: string) => console.log(`${pc.yellow('⚠')} ${msg}`),
  error: (msg: string) => console.log(`${pc.red('✖')} ${msg}`),
  heading: (msg: string) => console.log(`\n${pc.bold(pc.cyan(msg))}`),
  subtle: (msg: string) => console.log(pc.gray(msg)),
};
