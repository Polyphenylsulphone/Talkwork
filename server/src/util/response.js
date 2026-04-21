export function ok(data, message = 'success') {
  return { code: 200, data, message };
}

export function fail(code, message, data = null) {
  return { code, data, message };
}
