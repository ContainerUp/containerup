const units = ["B", "kB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];

const humanReadableSize = size => {
    let i = 0;
    const base = 1000;
    while (size >= base && i < units.length - 1) {
        size = size / base;
        i ++;
    }
    // div by 1 to remove tailing zeros
    return [size.toPrecision(3) / 1, units[i]];
};

const sizeUtil = {
    humanReadableSize
};

export default sizeUtil;
