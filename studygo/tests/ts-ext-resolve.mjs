/** Appends .ts when Node can't resolve extensionless relative/absolute specifiers. */
export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (error) {
    const canRetry = error?.code === "ERR_MODULE_NOT_FOUND"
      && !specifier.includes("node_modules")
      && !/\.(?:[cm]?[jt]s|json)$/.test(specifier)
      && (specifier.startsWith(".") || specifier.startsWith("/") || specifier.startsWith("file:"));
    if (!canRetry) throw error;
    return nextResolve(`${specifier}.ts`, context);
  }
}
