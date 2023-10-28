import MyTerminalTwoWay from "../../../../components/MyTerminalTwoWay";
import {Box} from "@mui/material";
import TwoWayPipe from "../../../../lib/TwoWayPipe";
import {useNavigate} from "react-router-dom";
import {useCallback, useEffect} from "react";
import term from "../../../../lib/termUtil";
import dataModel from "../../../../lib/dataModel";

const makeResizeData = (cols, rows) => {
    // r + ....
    return new Uint8Array([114, Math.floor(cols / 256), cols % 256, Math.floor(rows / 256), rows % 256]);
};

export default function ContainerExecTerminal({containerId, execOpts, stopPipeSide, start}) {
    const navigate = useNavigate();

    const dataPipe = new TwoWayPipe();
    const xtSide = dataPipe.useLeft();

    const connectExec = useCallback((containerId, execOpts) => {
        const xtWriter = xtSide.useWriter();
        const xtOnReceive = xtSide.useOnReceive();
        const terminationCallback = stopPipeSide.useWriter();

        xtWriter({type: 'data', data: term.reset + term.yellow('Connecting...')});

        const [promise, cancelFunc] = dataModel.containerExec(containerId, execOpts);

        let cancel = false;
        let terminated = false;

        let terminalCloser = () => {
            cancel = true;
            cancelFunc();
        };

        promise.then(handle => {
            xtWriter({type: 'data', data: term.reset});

            // 1 (std out) + data...
            // 2 (std err) + data...
            handle.onReceive(d => {
                // replace onReceive handler, send `start` only once
                handle.onReceive(d => xtWriter({type: 'data', data: new Uint8Array(d.slice(1))}));

                xtWriter({type: 'data', data: new Uint8Array(d.slice(1))});
                if (execOpts.tty) {
                    xtWriter({type: 'start'});
                }
            });

            handle.onClose(({code, reason}) => {
                if (code === 4001) {
                    let query = new URLSearchParams();
                    query.append('cb', '/containers/' + containerId + '/exec');
                    navigate('/login?' + query.toString());
                    return;
                }

                const now = new Date().toLocaleString();
                if (!terminated) {
                    xtWriter({type: 'data', data: term.crlf + term.red(`Session ended at ${now}.`)});
                    if (code === 1000) {
                        xtWriter({type: 'data', data: term.red(` (${reason})`)});
                    } else {
                        let reasonStr = '';
                        if (reason) {
                            reasonStr = `: ${reason}`;
                        }
                        xtWriter({type: 'data', data: term.red(` (Abnormally${reasonStr})`)});
                    }
                }
                terminationCallback();
                // console.log('Exec close', code, reason);
            });

            xtOnReceive(data => {
                switch (data.type) {
                    case 'data': {
                        handle.write('1' + data.data);
                        break;
                    }
                    case 'resize': {
                        if (execOpts.tty) {
                            const {cols, rows} = data.data;
                            handle.write(makeResizeData(cols, rows));
                        }
                        break;
                    }
                    default:
                        console.log('unknown xtSide command', data);
                }
            });

            terminalCloser = () => handle.close();
        }).catch(error => {
            if (cancel) {
                return;
            }
            const e = error.toString();
            xtWriter({type: 'data', data: term.reset + term.red(`Cannot execute command: ${e}.`)});
            terminationCallback();
            // console.log('catch', error)
        });

        const onReceiveStopAction = stopPipeSide.useOnReceive();
        onReceiveStopAction(() => {
            terminated = true;
            terminalCloser();
            const now = new Date().toLocaleString();
            xtWriter({type: 'data', data: term.crlf + term.red(`Session ended by user at ${now}.`)});
        });

        // closer
        return () => terminalCloser();
    }, [navigate, stopPipeSide, xtSide]);


    useEffect(() => {
        if (!start) {
            const xtWriter = xtSide.useWriter();
            const txt = 'Execute a command to start. Make sure the container is running.';
            xtWriter({type: 'data', data: term.reset + term.yellow(txt)});
            return;
        }

        const closer = connectExec(containerId, execOpts);
        return () => closer();
    }, [connectExec, execOpts, containerId, start, xtSide]);

    return (
        <Box sx={{height: 'calc(100vh - 214px)'}}>
            <MyTerminalTwoWay dataSide={dataPipe.useRight()} />
        </Box>
    );
}