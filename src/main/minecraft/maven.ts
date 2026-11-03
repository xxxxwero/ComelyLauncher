export interface MavenCoordinate {
  group: string;
  artifact: string;
  version: string;
  classifier: string | null;
  extension: string;
}

export function parseMaven(name: string): MavenCoordinate {
  const [coordinates, extension = 'jar'] = name.split('@');
  const [group, artifact, version, classifier] = coordinates.split(':');
  if (!group || !artifact || !version) throw new Error(`Invalid maven coordinate: ${name}`);
  return { group, artifact, version, classifier: classifier ?? null, extension };
}

export function mavenPath(name: string): string {
  const coordinate = parseMaven(name);
  const classifier = coordinate.classifier ? `-${coordinate.classifier}` : '';
  return [
    ...coordinate.group.split('.'),
    coordinate.artifact,
    coordinate.version,
    `${coordinate.artifact}-${coordinate.version}${classifier}.${coordinate.extension}`
  ].join('/');
}

export function mavenKey(name: string): string {
  const coordinate = parseMaven(name);
  return `${coordinate.group}:${coordinate.artifact}:${coordinate.classifier ?? ''}`;
}

export function joinUrl(base: string, relative: string): string {
  return `${base.endsWith('/') ? base : `${base}/`}${relative}`;
}
