/*
/* Find the number of starting characters shared between the given paths
*/
export function getCommonBasePathLength(paths: string[]): number {
    if (paths.length < 2)
        return 0;

    // Split path into sections
    const parts = paths.map(s => s.split(/[\\/]/));
    // Find min length
    const minLength = parts.reduce((minLength, parts) => Math.min(parts.length, minLength), 32768) - 1;
    // Compare parts to find common sections
    let i = 0;
    let len = 0;
    for (; i < minLength; ++i) {
        for (let j = 1; j < parts.length; ++j)
            if (parts[j][i] != parts[0][i])
                break;
        len += parts[0][i].length + 1;
    }
    return Math.max(0, len - 1);
}