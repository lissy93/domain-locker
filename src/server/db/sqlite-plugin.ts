import {
  OperationNodeTransformer,
  type KyselyPlugin,
  type PluginTransformQueryArgs,
  type PluginTransformResultArgs,
  type PrimitiveValueListNode,
  type QueryResult,
  type RootOperationNode,
  type UnknownRow,
  type ValueNode,
} from 'kysely';

/** Columns stored as INTEGER 0/1 in SQLite but exposed as booleans */
const BOOLEAN_COLUMNS = new Set([
  'auto_renew',
  'is_enabled',
  'is_ipv6',
  'is_up',
  'read',
  'sent',
]);

/** Columns stored as TEXT in SQLite but exposed as parsed JSON */
const JSON_COLUMNS = new Set(['notification_channels', 'sd_info']);

const toStorage = (value: unknown) => (typeof value === 'boolean' ? +value : value);

class BooleanParameterTransformer extends OperationNodeTransformer {
  protected override transformValue(node: ValueNode): ValueNode {
    return { ...super.transformValue(node), value: toStorage(node.value) };
  }

  // Insert rows arrive as raw primitives rather than ValueNodes
  protected override transformPrimitiveValueList(
    node: PrimitiveValueListNode,
  ): PrimitiveValueListNode {
    return {
      ...super.transformPrimitiveValueList(node),
      values: node.values.map(toStorage),
    };
  }
}

/**
 * Bridges the gaps between SQLite storage classes and the shared schema:
 * SQLite cannot bind booleans, and has no JSON or boolean types on the way back.
 */
export class SqliteTypePlugin implements KyselyPlugin {
  readonly #transformer = new BooleanParameterTransformer();

  transformQuery(args: PluginTransformQueryArgs): RootOperationNode {
    return this.#transformer.transformNode(args.node);
  }

  async transformResult(
    args: PluginTransformResultArgs,
  ): Promise<QueryResult<UnknownRow>> {
    return { ...args.result, rows: args.result.rows.map(coerceRow) };
  }
}

function coerceRow(row: UnknownRow): UnknownRow {
  let coerced: UnknownRow | null = null;
  for (const [column, value] of Object.entries(row)) {
    const next = coerceValue(column, value);
    if (next === value) continue;
    coerced ??= { ...row };
    coerced[column] = next;
  }
  return coerced ?? row;
}

function coerceValue(column: string, value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (BOOLEAN_COLUMNS.has(column) && typeof value === 'number') return value === 1;
  if (JSON_COLUMNS.has(column) && typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
  return value;
}
