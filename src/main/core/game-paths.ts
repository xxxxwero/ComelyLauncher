import path from 'node:path';

export class GamePaths {
  constructor(readonly root: string) {}

  get versions(): string {
    return path.join(this.root, 'versions');
  }

  get libraries(): string {
    return path.join(this.root, 'libraries');
  }

  get assets(): string {
    return path.join(this.root, 'assets');
  }

  get runtimes(): string {
    return path.join(this.root, 'runtime');
  }

  get profiles(): string {
    return path.join(this.root, 'profiles');
  }

  get cache(): string {
    return path.join(this.root, 'cache');
  }

  versionDir(versionId: string): string {
    return path.join(this.versions, versionId);
  }

  versionJson(versionId: string): string {
    return path.join(this.versionDir(versionId), `${versionId}.json`);
  }

  versionJar(versionId: string): string {
    return path.join(this.versionDir(versionId), `${versionId}.jar`);
  }

  nativesDir(versionId: string): string {
    return path.join(this.versionDir(versionId), 'natives');
  }

  library(relativePath: string): string {
    return path.join(this.libraries, ...relativePath.split('/'));
  }

  assetIndex(indexId: string): string {
    return path.join(this.assets, 'indexes', `${indexId}.json`);
  }

  assetObject(hash: string): string {
    return path.join(this.assets, 'objects', hash.slice(0, 2), hash);
  }

  virtualAssets(indexId: string): string {
    return path.join(this.assets, 'virtual', indexId);
  }

  logConfig(fileId: string): string {
    return path.join(this.assets, 'log_configs', fileId);
  }

  runtime(component: string): string {
    return path.join(this.runtimes, component);
  }

  instanceDir(folderName: string): string {
    return path.join(this.profiles, folderName);
  }
}
