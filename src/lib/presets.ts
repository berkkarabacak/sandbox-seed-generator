import type { SeedConfig } from "@/types";
import { DEFAULT_CONFIG } from "./generator";

export interface Preset {
  id: string;
  label: string;
  blurb: string;
  icon: string; // lucide name resolved by caller
  config: Partial<SeedConfig>;
}

export const PRESETS: Preset[] = [
  {
    id: "exec-demo",
    label: "Executive demo",
    blurb: "Tidy board, strong narrative, nothing embarrassing",
    icon: "Presentation",
    config: {
      scenario: "scrum", domain: "devtools", projectCount: 2, issuesPerProject: 40,
      teamSize: 7, commentDensity: 45, spreadWeeks: 8, chaos: 10,
      withSprints: true, withStoryPoints: true, withLabels: true, withLinks: true, detail: "balanced",
    },
  },
  {
    id: "uat-deep",
    label: "UAT deep-dive",
    blurb: "Dense, messy, lots of history for testers to chew on",
    icon: "FlaskConical",
    config: {
      scenario: "kanban", domain: "ecommerce", projectCount: 3, issuesPerProject: 90,
      teamSize: 10, commentDensity: 85, spreadWeeks: 14, chaos: 55,
      withSprints: false, withStoryPoints: true, withLabels: true, withLinks: true, detail: "verbose",
    },
  },
  {
    id: "qa-training",
    label: "QA training",
    blurb: "Bug-dense set with STR, severities and regressions",
    icon: "Bug",
    config: {
      scenario: "bugbash", domain: "gaming", projectCount: 2, issuesPerProject: 95,
      teamSize: 8, commentDensity: 65, spreadWeeks: 6, chaos: 40,
      withSprints: true, withStoryPoints: false, withLabels: true, withLinks: true, detail: "verbose",
    },
  },
  {
    id: "load-test",
    label: "Load test",
    blurb: "640 issues, terse bodies — volume over prose",
    icon: "Gauge",
    config: {
      scenario: "scrum", domain: "logistics", projectCount: 4, issuesPerProject: 160,
      teamSize: 12, commentDensity: 15, spreadWeeks: 4, chaos: 25,
      withSprints: true, withStoryPoints: true, withLabels: true, withLinks: false, detail: "terse",
    },
  },
  {
    id: "servicedesk",
    label: "Service desk sim",
    blurb: "Customer-style requests flowing through a support queue",
    icon: "Headset",
    config: {
      scenario: "servicedesk", domain: "healthcare", projectCount: 2, issuesPerProject: 70,
      teamSize: 6, commentDensity: 60, spreadWeeks: 10, chaos: 30,
      withSprints: false, withStoryPoints: false, withLabels: true, withLinks: true, detail: "balanced",
    },
  },
];

export function applyPreset(p: Preset): SeedConfig {
  return { ...DEFAULT_CONFIG, ...p.config, seed: Math.floor(Math.random() * 99999) };
}
