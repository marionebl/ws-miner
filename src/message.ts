const PRELUDE_LENGTH = 8;

export function serialize(header: object, body: object | string): string {
  const bodyType = typeof body === "object" ? "json" : "string";
  const serializedHeader = JSON.stringify({ ...header, bodyType });
  const len = serializedHeader.length.toString().padStart(PRELUDE_LENGTH, "0");
  const serialized = bodyType === "json" ? JSON.stringify(body) : body;
  return `${len}${serializedHeader}${serialized}`;
}

export function deserialize<H, B>(
  payload: string
): [Error, null] | [null, { header: H; body: B }] {
  const headerLength = parseInt(payload.slice(0, PRELUDE_LENGTH), 10);

  if (Number.isNaN(headerLength)) {
    return [new Error("Invalid header"), null];
  }

  const headerResult = parse<{ bodyType: string }>(
    payload.slice(PRELUDE_LENGTH, PRELUDE_LENGTH + headerLength)
  );

  if (headerResult[0]) {
    return [headerResult[0], null];
  }

  const bodyResult =
    headerResult[1].bodyType === "json"
      ? parse(payload.slice(PRELUDE_LENGTH + headerLength))
      : [null, payload.slice(PRELUDE_LENGTH + headerLength)] as const;

  if (bodyResult[0]) {
    return [bodyResult[0], null];
  }

  return [
    null,
    {
      header: headerResult[1] as unknown as H,
      body: bodyResult[1] as unknown as B,
    },
  ];
}

function parse<T>(
  input: string
): Readonly<[Error, null]> | Readonly<[null, T]> {
  try {
    return [null, JSON.parse(input)];
  } catch (err) {
    return [err, null];
  }
}
