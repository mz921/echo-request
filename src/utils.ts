function arrayFrom<T>(val: T): T extends any[] ? T : [T] {
	return (Array.isArray(val) ? val : [val]) as any;
}

function runAll(funcs: ((...args: any[]) => void)[], args: any) {
	return funcs.forEach((func) => func(args));
}

function mergeArray(objValue: unknown, srcValue: unknown) {
  if (Array.isArray(objValue)) {
    return objValue.concat(srcValue);
  }
}

function runOnce(func: (...args: any[]) => any) {
    let run = false;

    return (...args: any[]) => {
        if (!run) {
            run = true
            return func(...args)
        }
    }
}

function skipFirstRun(func: Function) {
    let isFirst = true

    return function _f(...args: any[]) {
        if (!isFirst) {
            return func(...args)
        }
        isFirst = false;
        return _f;
    }
}

function isNotEmptyObject<T>(obj: {} | T, msg?: string): asserts obj is T {
    if (Object.keys(obj).length === 0) throw new Error(msg || "Object can not be empty")
}

function assertIsDefined<T>(val: T): asserts val is NonNullable<T> {
  if (val === undefined || val === null) {
    throw new Error(
      `Expected 'val' to be defined, but received ${val}`
    );
  }
}
export { arrayFrom, runAll, mergeArray, runOnce, skipFirstRun, isNotEmptyObject, assertIsDefined };
