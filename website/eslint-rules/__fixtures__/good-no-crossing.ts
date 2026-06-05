// Directive-free module importing from another directive-free module.
// No RSC boundary crossing — the rule should NOT flag this.
import { neutralHelper } from './neutral-module';

export function goodFn(): string {
  return neutralHelper();
}
