import type { Persona } from "@/types";
import { pick, shuffle, type Rng } from "./rng";

const FIRST = [
  "Maya", "Jonas", "Priya", "Diego", "Sofia", "Kenji", "Amara", "Lukas",
  "Ines", "Tomas", "Nadia", "Felix", "Grace", "Omar", "Hana", "Viktor",
  "Elena", "Marcus", "Aisha", "Ravi", "Clara", "Sam", "Yuki", "Leo",
  "Freya", "Dmitri", "Zara", "Henrik", "Lena", "Kofi",
];

const LAST = [
  "Lindqvist", "Okafor", "Tanaka", "Fischer", "Moreau", "Petrov", "Nguyen",
  "Silva", "Kowalski", "Haddad", "Berg", "Costa", "Kim", "Novak", "Reyes",
  "Ali", "Jansen", "Meyer", "Sato", "Dubois", "Larsen", "Iqbal", "Weber",
];

const ROLES = [
  ["Product Manager", "Engineering Lead"],
  ["Frontend Engineer", "Frontend Engineer", "Backend Engineer", "Backend Engineer"],
  ["Full-stack Engineer", "QA Engineer", "Designer"],
  ["SRE", "Data Engineer", "QA Engineer", "Designer"],
] as const;

const TIMEZONES = ["UTC+1", "UTC+2", "UTC-5", "UTC-8", "UTC+9", "UTC+5:30", "UTC+10"];

/** Pleasant, saturated avatar hues spread around the wheel. */
const HUES = [172, 210, 262, 24, 340, 84, 190, 290, 48, 0, 140, 320];

export function makePersonas(rng: Rng, count: number): Persona[] {
  const names = shuffle(rng, FIRST.flatMap((f) => LAST.map((l) => `${f} ${l}`)));
  const roles = ROLES.flatMap((r) => [...r]);
  const shuffledRoles = shuffle(rng, roles);
  const people: Persona[] = [];

  for (let i = 0; i < count; i++) {
    const name = names[i % names.length];
    const parts = name.split(" ");
    people.push({
      id: `u${i + 1}`,
      name,
      initials: (parts[0][0] + parts[parts.length - 1][0]).toUpperCase(),
      role: shuffledRoles[i % shuffledRoles.length],
      color: `hsl(${HUES[i % HUES.length]} 70% 55%)`,
      timezone: pick(rng, TIMEZONES),
    });
  }
  // Ensure at least one PM and one lead feel present in small teams.
  if (count >= 3) {
    people[0].role = "Product Manager";
    people[1].role = "Engineering Lead";
  }
  return people;
}
