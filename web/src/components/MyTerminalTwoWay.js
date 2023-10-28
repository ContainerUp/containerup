import {useEffect, useRef} from "react";
import {Box} from "@mui/material";
import {Terminal} from "xterm";
import { FitAddon } from 'xterm-addon-fit';

export default function MyTerminalTwoWay({dataSide}) {
    const ref = useRef();

    useEffect(() => {
        if (!dataSide) {
            return () => {};
        }
        const dsWriter = dataSide.useWriter();
        const dsOnReceive = dataSide.useOnReceive();

        const xterm = new Terminal({
            fontSize: 13
        });
        const fitAddon = new FitAddon();
        xterm.loadAddon(fitAddon);
        xterm.open(ref.current);
        fitAddon.fit();

        const reportSize = ({cols, rows}) => {
            dsWriter({type: 'resize', data: {cols, rows}});
        };

        dsOnReceive(data => {
            switch (data.type) {
                case 'data': {
                    xterm.write(data.data);
                    break;
                }
                case 'start': {
                    reportSize({cols: xterm.cols, rows: xterm.rows});
                    xterm.focus();
                    break;
                }
                default:
                    console.log('unknown dataSide command', data);
            }
        });
        xterm.onData(str => dsWriter({type: 'data', data: str}));
        xterm.onResize(({cols, rows}) => reportSize({cols, rows}));

        const handleWindowsResize = () => {
            fitAddon.fit();
        };
        window.addEventListener('resize', handleWindowsResize);

        return () => {
            dsOnReceive(null);
            xterm.dispose();
            window.removeEventListener('resize', handleWindowsResize);
        };
    });

    return (
        <Box ref={ref} sx={{height: '100%'}}>
        </Box>
    );
}