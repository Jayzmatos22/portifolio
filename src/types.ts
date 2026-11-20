export interface Profile {
  readonly name: string;
  readonly user: string;
  readonly role: string;
  readonly status: string;
  readonly github: string;
  readonly githubLabel: string;
  readonly email: string;
  readonly linkedin: string;
  readonly linkedinLabel: string;
}

export interface Education {
  readonly course: string;
  /** e.g. "Tecnólogo", "Bacharelado". */
  readonly degree: string;
  readonly institution: string;
  /** Completion month (expected or actual), formatted YYYY-MM. */
  readonly completion: string;
  readonly inProgress: boolean;
}

export type VisualKind = 'blackhole' | 'market';

export type DeviceKind = 'desktop' | 'tablet' | 'mobile';

export interface Screenshot {
  /** Image URL (imported through Vite so it gets hashed and optimized). */
  readonly src: string;
  readonly title: string;
  readonly caption: string;
  readonly device: DeviceKind;
  /** Intrinsic size in px, used to keep the aspect ratio while laying out the gallery. */
  readonly width: number;
  readonly height: number;
}

export interface ProjectLinks {
  /** Public URL of the running app; empty when there is none. */
  readonly live: string;
  readonly repo: string;
}

export interface Project {
  readonly id: string;
  readonly index: string;
  readonly name: string;
  readonly kind: string;
  readonly status: string;
  readonly summary: string;
  readonly highlights: readonly string[];
  readonly stack: readonly string[];
  readonly links: ProjectLinks;
  readonly visual: VisualKind;
  readonly screens: readonly Screenshot[];
}

/** [technology, where it was used] */
export type StackItem = readonly [name: string, usedIn: string];

export interface StackGroup {
  readonly group: string;
  readonly items: readonly StackItem[];
}

/** A label orbiting the hero portrait. Angles in degrees. */
export interface OrbitArc {
  readonly r: number;
  readonly from: number;
  readonly to: number;
  readonly dot: number;
  readonly title: string;
  readonly label: string;
}

export type VirtualFiles = Readonly<Record<string, readonly string[]>>;
