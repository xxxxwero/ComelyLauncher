export enum TagType {
  End = 0,
  Byte = 1,
  Short = 2,
  Int = 3,
  Long = 4,
  Float = 5,
  Double = 6,
  ByteArray = 7,
  String = 8,
  List = 9,
  Compound = 10,
  IntArray = 11,
  LongArray = 12
}

export type NbtTag =
  | { type: TagType.Byte | TagType.Short | TagType.Int | TagType.Float | TagType.Double; value: number }
  | { type: TagType.Long; value: bigint }
  | { type: TagType.ByteArray; value: Buffer }
  | { type: TagType.String; value: string }
  | { type: TagType.List; elementType: TagType; value: NbtTag[] }
  | { type: TagType.Compound; value: Record<string, NbtTag> }
  | { type: TagType.IntArray; value: number[] }
  | { type: TagType.LongArray; value: bigint[] };

class NbtReader {
  private offset = 0;

  constructor(private readonly buffer: Buffer) {}

  byte(): number {
    return this.buffer.readInt8(this.offset++);
  }

  short(): number {
    const value = this.buffer.readInt16BE(this.offset);
    this.offset += 2;
    return value;
  }

  int(): number {
    const value = this.buffer.readInt32BE(this.offset);
    this.offset += 4;
    return value;
  }

  string(): string {
    const length = this.buffer.readUInt16BE(this.offset);
    this.offset += 2;
    const value = this.buffer.toString('utf8', this.offset, this.offset + length);
    this.offset += length;
    return value;
  }

  payload(type: TagType): NbtTag {
    switch (type) {
      case TagType.Byte:
        return { type, value: this.byte() };
      case TagType.Short:
        return { type, value: this.short() };
      case TagType.Int:
        return { type, value: this.int() };
      case TagType.Long: {
        const value = this.buffer.readBigInt64BE(this.offset);
        this.offset += 8;
        return { type, value };
      }
      case TagType.Float: {
        const value = this.buffer.readFloatBE(this.offset);
        this.offset += 4;
        return { type, value };
      }
      case TagType.Double: {
        const value = this.buffer.readDoubleBE(this.offset);
        this.offset += 8;
        return { type, value };
      }
      case TagType.ByteArray: {
        const length = this.int();
        const value = Buffer.from(this.buffer.subarray(this.offset, this.offset + length));
        this.offset += length;
        return { type, value };
      }
      case TagType.String:
        return { type, value: this.string() };
      case TagType.List: {
        const elementType = this.byte() as TagType;
        const length = this.int();
        const value: NbtTag[] = [];
        for (let index = 0; index < length; index++) value.push(this.payload(elementType));
        return { type, elementType, value };
      }
      case TagType.Compound: {
        const value: Record<string, NbtTag> = {};
        for (;;) {
          const childType = this.byte() as TagType;
          if (childType === TagType.End) break;
          const name = this.string();
          value[name] = this.payload(childType);
        }
        return { type, value };
      }
      case TagType.IntArray: {
        const length = this.int();
        return { type, value: Array.from({ length }, () => this.int()) };
      }
      case TagType.LongArray: {
        const length = this.int();
        const value: bigint[] = [];
        for (let index = 0; index < length; index++) {
          value.push(this.buffer.readBigInt64BE(this.offset));
          this.offset += 8;
        }
        return { type, value };
      }
      default:
        throw new Error(`Unsupported NBT tag ${type}`);
    }
  }
}

class NbtWriter {
  private readonly chunks: Buffer[] = [];

  byte(value: number): void {
    const buffer = Buffer.alloc(1);
    buffer.writeInt8(value);
    this.chunks.push(buffer);
  }

  short(value: number): void {
    const buffer = Buffer.alloc(2);
    buffer.writeInt16BE(value);
    this.chunks.push(buffer);
  }

  int(value: number): void {
    const buffer = Buffer.alloc(4);
    buffer.writeInt32BE(value);
    this.chunks.push(buffer);
  }

  long(value: bigint): void {
    const buffer = Buffer.alloc(8);
    buffer.writeBigInt64BE(value);
    this.chunks.push(buffer);
  }

  string(value: string): void {
    const bytes = Buffer.from(value, 'utf8');
    const length = Buffer.alloc(2);
    length.writeUInt16BE(bytes.length);
    this.chunks.push(length, bytes);
  }

  payload(tag: NbtTag): void {
    switch (tag.type) {
      case TagType.Byte:
        this.byte(tag.value);
        break;
      case TagType.Short:
        this.short(tag.value);
        break;
      case TagType.Int:
        this.int(tag.value);
        break;
      case TagType.Long:
        this.long(tag.value);
        break;
      case TagType.Float: {
        const buffer = Buffer.alloc(4);
        buffer.writeFloatBE(tag.value);
        this.chunks.push(buffer);
        break;
      }
      case TagType.Double: {
        const buffer = Buffer.alloc(8);
        buffer.writeDoubleBE(tag.value);
        this.chunks.push(buffer);
        break;
      }
      case TagType.ByteArray:
        this.int(tag.value.length);
        this.chunks.push(tag.value);
        break;
      case TagType.String:
        this.string(tag.value);
        break;
      case TagType.List:
        this.byte(tag.value.length === 0 ? TagType.End : tag.elementType);
        this.int(tag.value.length);
        for (const item of tag.value) this.payload(item);
        break;
      case TagType.Compound:
        for (const [name, child] of Object.entries(tag.value)) {
          this.byte(child.type);
          this.string(name);
          this.payload(child);
        }
        this.byte(TagType.End);
        break;
      case TagType.IntArray:
        this.int(tag.value.length);
        for (const item of tag.value) this.int(item);
        break;
      case TagType.LongArray:
        this.int(tag.value.length);
        for (const item of tag.value) this.long(item);
        break;
    }
  }

  result(): Buffer {
    return Buffer.concat(this.chunks);
  }
}

export function readNbt(buffer: Buffer): { name: string; tag: NbtTag } {
  const reader = new NbtReader(buffer);
  const type = reader.byte() as TagType;
  if (type !== TagType.Compound) throw new Error('Root NBT tag must be a compound');
  const name = reader.string();
  return { name, tag: reader.payload(type) };
}

export function writeNbt(name: string, tag: NbtTag): Buffer {
  const writer = new NbtWriter();
  writer.byte(tag.type);
  writer.string(name);
  writer.payload(tag);
  return writer.result();
}
