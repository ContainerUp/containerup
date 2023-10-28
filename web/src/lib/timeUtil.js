import {parse} from "date-fns";

// output: [human-readable string, suggested refresh time in seconds]
const dateAgo = d => {
    const now = Math.floor(Date.now() / 1000);
    const p = Math.floor(d.getTime() / 1000);
    const delta = now - p;
    if (delta < 0) {
        return [d.toLocaleString(), -1];
    }

    if (delta < 1) {
        return ['Less than a second', 1];
    }
    if (delta < 2) {
        return ['1 second ago', 1];
    }
    if (delta < 60) {
        return [delta + ' seconds ago', 1];
    }

    if (delta < 120) {
        return ['About a minute ago', 10];
    }
    if (delta < 3600) {
        return [Math.floor(delta / 60) +  ' minutes ago', 60];
    }

    if (delta < 7200) {
        return ['About an hour ago', 300];
    }
    if (delta < 3600 * 24 * 2) {
        return [Math.floor(delta / 3600) +  ' hours ago', 1200];
    }

    if (delta < 3600 * 24 * 14) {
        return [Math.floor(delta / 3600 / 24) + ' days ago', 3600];
    }

    if (delta < 3600 * 24 * 60) {
        return [Math.floor(delta / 3600 / 24 / 7) + ' weeks ago', 3600 * 24];
    }

    if (delta < 3600 * 24 * 365 * 2) {
        return [Math.floor(delta / 2600 / 24 / 30) + ' months ago', 3600 * 24];
    }

    return [Math.floor(delta / 3600 / 24 / 365) +  ' years ago', 3600 * 24];
};

const parseRFC3339Nano = str => {
    return parse(str, `yyyy-MM-dd'T'HH:mm:ss.SSSSSSSSSXXX`, new Date());
};

const timeUtil = {
    dateAgo,
    parseRFC3339Nano
};

export default timeUtil;
