const colorEnd = '\x1b[0m';

const color = {
    black: '\x1b[30m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    white: '\x1b[37m',
    reset: '\x1b\x63'
};

const colorText = (text, colorName) => {
    return color[colorName] + text + colorEnd;
};

const termUtil = {
    red: t => colorText(t, 'red'),
    yellow: t => colorText(t, 'yellow'),
    green: t => colorText(t, 'green'),
    reset: '\x1b\x63',
    crlf: '\r\n'
};

export default termUtil;