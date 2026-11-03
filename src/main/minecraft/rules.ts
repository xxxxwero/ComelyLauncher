import os from 'node:os';
import type { Rule } from './version-json';

export type LaunchFeatures = Partial<Record<
  | 'is_demo_user'
  | 'has_custom_resolution'
  | 'has_quick_plays_support'
  | 'is_quick_play_singleplayer'
  | 'is_quick_play_multiplayer'
  | 'is_quick_play_realms',
  boolean
>>;

export function currentArchitecture(): 'x86' | 'x64' | 'arm64' {
  if (process.arch === 'ia32') return 'x86';
  if (process.arch === 'arm64') return 'arm64';
  return 'x64';
}

function osMatches(rule: Rule): boolean {
  if (!rule.os) return true;
  if (rule.os.name && rule.os.name !== 'windows') return false;
  if (rule.os.arch && rule.os.arch !== currentArchitecture()) return false;
  if (rule.os.version) {
    try {
      if (!new RegExp(rule.os.version).test(os.release())) return false;
    } catch {
      return false;
    }
  }
  return true;
}

function featuresMatch(rule: Rule, features: LaunchFeatures): boolean {
  if (!rule.features) return true;
  return Object.entries(rule.features).every(([key, value]) => Boolean(features[key as keyof LaunchFeatures]) === value);
}

export function isAllowedByRules(rules: Rule[] | undefined, features: LaunchFeatures = {}): boolean {
  if (!rules || rules.length === 0) return true;
  let allowed = false;
  for (const rule of rules) {
    if (osMatches(rule) && featuresMatch(rule, features)) allowed = rule.action === 'allow';
  }
  return allowed;
}
