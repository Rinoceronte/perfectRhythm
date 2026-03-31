export function ok<T>(data: T) {
	return Response.json({ data, error: null });
}

export function err(code: string, message: string, status = 400) {
	return Response.json({ data: null, error: { code, message, status } }, { status });
}
