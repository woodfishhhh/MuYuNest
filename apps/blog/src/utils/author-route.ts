export const AUTHOR_SCREEN_COUNT = 4;

function getScalarPageParam(value: unknown) {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

export function isValidAuthorPageParam(value: unknown) {
  const scalar = getScalarPageParam(value);
  if (typeof scalar !== "string" || !/^\d+$/.test(scalar)) {
    return false;
  }

  const page = Number(scalar);
  return page >= 1 && page <= AUTHOR_SCREEN_COUNT;
}

export function resolveAuthorPage(value: unknown) {
  const scalar = getScalarPageParam(value);
  if (typeof scalar !== "string" || !/^\d+$/.test(scalar)) {
    return 1;
  }

  const page = Number(scalar);
  return page >= 1 && page <= AUTHOR_SCREEN_COUNT ? page : 1;
}

function normalizePathname(path: string) {
  const pathname = path.split(/[?#]/, 1)[0]?.replace(/\/+$/, "") ?? "";
  return pathname || "/";
}

export function isAuthorRoutePath(path: string | undefined) {
  if (typeof path !== "string") {
    return false;
  }

  const pathname = normalizePathname(path);
  if (pathname === "/author") {
    return true;
  }

  const authorPage = pathname.match(/^\/author\/(\d+)$/)?.[1];
  const rootPage = pathname.match(/^\/(\d+)$/)?.[1];
  return isValidAuthorPageParam(authorPage ?? rootPage);
}

export function getAuthorRoutePath(page: number, currentPath = "/author") {
  const safePage = Math.max(1, Math.min(AUTHOR_SCREEN_COUNT, Math.trunc(page)));
  const pathname = normalizePathname(currentPath);

  return /^\/\d+$/.test(pathname) ? `/${safePage}` : `/author/${safePage}`;
}
